"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bomb,
  Coins,
  Flame,
  Hammer,
  Heart,
  Plus,
  RotateCcw,
  Shuffle,
  ShoppingCart,
  Star,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  applyHammer,
  BLOCK_COLORS,
  bombsInLines,
  boardBombCount,
  boardBombTimerFor,
  canPlace,
  canPlaceAnywhere,
  clearScore,
  emptyGrid,
  explodeCrater,
  fullLines,
  generatePieces,
  GRID_SIZE,
  IDLE_BOMB_TICK,
  isStone,
  MAX_BOARD_BOMBS,
  spawnBoardBomb,
  spawnStones,
  tickBoardBombs,
  type Grid,
  type Piece,
} from "./engine";
import { Sfx, vibrate } from "./sfx";
import {
  computeLayout,
  drawBoard,
  drawClearPreview,
  drawFireBorder,
  drawGhost,
  drawHammerTarget,
  drawPieceAt,
  drawTray,
  easeOutCubic,
  FIRE_COLORS,
  hasLowBomb,
  idleRing,
  spawnBurst,
  spawnBurstAt,
  TRAY_SCALE,
  updateParticles,
  updateTexts,
  type DragState,
  type GameState,
  type LayoutMetrics,
} from "./render";
import { coinsFor, collectGoal, goalProgressTexts, goalReached, scoreMultiplier, starsFor, type LevelDef } from "./levels";
import { tr, type Lang, type Strings } from "./i18n";
import { PRICES, type BoosterKind } from "./progress";

export interface LevelResult {
  levelN: number;
  won: boolean;
  stars: number;
  coins: number;
  firstClear: boolean;
}

interface Props {
  level: LevelDef;
  firstClear: boolean;
  boosters: { hammer: number; shuffle: number; plus5: number };
  /** баланс монет — для магазина внутри уровня */
  coins: number;
  muted: boolean;
  lang: Lang;
  onToggleMute: () => void;
  onUseBooster: (kind: BoosterKind) => void;
  /** покупка бустера; false — не хватило монет */
  onBuyBooster: (kind: BoosterKind) => boolean;
  /** награда за просмотр рекламы; возвращает новый баланс монет */
  onAdReward: (reward: number) => number;
  /** сколько монет даёт реклама */
  adReward: number;
  onLevelEnd: (result: LevelResult, goNext: boolean) => void;
  onExit: () => void;
}

/** длительность демо-«рекламы», секунд */
const AD_SECONDS = 5;

function makeInitialGame(level: LevelDef): GameState {
  const grid = emptyGrid();
  if (level.stones > 0) spawnStones(grid, level.stones);
  return {
    grid,
    pieces: [null, null, null],
    dead: [false, false, false],
    drag: null,
    anim: null,
    particles: [],
    texts: [],
    pops: [],
    shake: 0,
    time: 0,
    streak: 0,
    score: 0,
    bestStart: 0,
    lines: 0,
    lives: 3,
    defused: 0,
    placements: 0,
    nextBombAt: level.bombsFrom,
    idleAcc: 0,
    collected: 0,
    goalColor: collectGoal(level)?.color,
    armed: false,
    hammerTarget: null,
    overReason: null,
    over: false,
  };
}

/** Генерация с подмешиванием цвета цели: иначе collect-цели недостижимы */
function piecesFor(level: LevelDef, grid: Grid, allowBomb: boolean): Piece[] {
  const bias = collectGoal(level)?.color;
  return generatePieces(grid, level.diff, allowBomb, bias);
}

function refreshDead(g: GameState): void {
  g.dead = g.pieces.map((p) => (p ? !canPlaceAnywhere(g.grid, p.shape) : false));
}

export default function GameScreen({
  level,
  firstClear,
  boosters,
  coins,
  muted,
  lang,
  onToggleMute,
  onUseBooster,
  onBuyBooster,
  onAdReward,
  adReward,
  onLevelEnd,
  onExit,
}: Props) {
  const t = tr(lang);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const layoutRef = useRef<LayoutMetrics>(computeLayout(320, 1));
  const gameRef = useRef<GameState>(makeInitialGame(level));
  const movesLeftRef = useRef(level.moves);
  const phaseRef = useRef<"play" | "won" | "lost">("play");
  const timersRef = useRef<number[]>([]);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [linesCleared, setLinesCleared] = useState(0);
  const [lives, setLives] = useState(3);
  const [defused, setDefused] = useState(0);
  const [collected, setCollected] = useState(0);
  const [movesLeft, setMovesLeft] = useState(level.moves);
  const [phase, setPhase] = useState<"play" | "won" | "lost">("play");
  const [loseReason, setLoseReason] = useState<"bombs" | "stall" | "moves" | null>(null);
  const [result, setResult] = useState<{ stars: number; coins: number } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [armed, setArmed] = useState(false);
  // задачи уровня подсвечиваются на старте (~4 секунды), чтобы было ясно, что делать
  const [goalFlash, setGoalFlash] = useState(true);

  // ── Магазин внутри уровня (покупка бустеров не выходя в меню) ──────────
  const [shopOpen, setShopOpen] = useState(false);
  const shopOpenRef = useRef(false);
  const openShop = useCallback(() => {
    shopOpenRef.current = true;
    setShopOpen(true);
  }, []);
  const closeShop = useCallback(() => {
    shopOpenRef.current = false;
    setShopOpen(false);
  }, []);

  // ── «Реклама» за монеты: 5 секунд демо-ролика → +adReward монет ────────
  const [adPlaying, setAdPlaying] = useState(false);
  const adPlayingRef = useRef(false);
  const [adLeft, setAdLeft] = useState(AD_SECONDS * 1000);
  const [adDone, setAdDone] = useState(false);
  /** бустер, ради которого смотрят рекламу (сразу докупается после награды) */
  const [adPending, setAdPending] = useState<BoosterKind | null>(null);
  const startAd = useCallback((pending: BoosterKind | null) => {
    adPlayingRef.current = true;
    setAdLeft(AD_SECONDS * 1000);
    setAdDone(false);
    setAdPlaying(true);
    setAdPending(pending);
  }, []);
  const endAd = useCallback(() => {
    adPlayingRef.current = false;
    setAdPlaying(false);
    setAdPending(null);
  }, []);

  // отсчёт рекламы: 5 секунд, потом кнопка награды
  useEffect(() => {
    if (!adPlaying) return;
    const started = performance.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, AD_SECONDS * 1000 - (performance.now() - started));
      setAdLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        setAdDone(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [adPlaying]);

  const getSfx = useCallback((): Sfx => {
    if (!sfxRef.current) sfxRef.current = new Sfx();
    sfxRef.current.muted = muted;
    return sfxRef.current;
  }, [muted]);

  const addTimer = (id: number) => {
    timersRef.current.push(id);
  };

  // Инициализация: фигуры сразу; чипы задач сверху подсвечиваются первые ~4 с
  // (goalFlash стартует true — таймер снимает подсветку)
  useEffect(() => {
    const g = gameRef.current;
    g.pieces = piecesFor(level, g.grid, false);
    refreshDead(g);
    const tid = window.setTimeout(() => setGoalFlash(false), 4000);
    return () => {
      window.clearTimeout(tid);
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
    };
  }, [level]);

  // Синхронизация mute
  useEffect(() => {
    if (sfxRef.current) sfxRef.current.muted = muted;
  }, [muted]);

  // живые значения монет/бустеров для dev-хука (e2e)
  const coinsRef = useRef(coins);
  const boostersRef = useRef(boosters);
  useEffect(() => {
    coinsRef.current = coins;
    boostersRef.current = boosters;
  }, [coins, boosters]);

  // Отладочный хук для e2e-тестов (только в dev-сборке)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __BB__?: () => Record<string, unknown> };
      w.__BB__ = () => {
        const g = gameRef.current;
        return {
          score: g.score,
          placements: g.placements,
          movesLeft: movesLeftRef.current,
          lives: g.lives,
          bombs: boardBombCount(g.grid),
          lines: g.lines,
          defused: g.defused,
          collected: g.collected,
          goalColor: g.goalColor ?? null,
          goals: level.goals,
          stones: g.grid.flat().filter(isStone).length,
          idleAcc: g.idleAcc,
          trayColors: g.pieces.map((p) => (p ? p.color : null)),
          grid: g.grid.map((row) => row.slice()),
          phase: phaseRef.current,
          over: g.over,
          reason: g.overReason,
          coins: coinsRef.current,
          boosters: { ...boostersRef.current },
          shopOpen: shopOpenRef.current,
          adPlaying: adPlayingRef.current,
          adPending,
        };
      };
    }
  }, [level, adPending]);

  // Адаптивный размер canvas
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const apply = () => {
      const w = wrap.clientWidth;
      if (w <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const L = computeLayout(w, dpr);
      layoutRef.current = L;
      canvas.width = Math.round(L.W * dpr);
      canvas.height = Math.round(L.H * dpr);
      canvas.style.height = `${L.H}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Победа: фанфара, конфетти, звёзды и награда
  const winLevel = useCallback(() => {
    const g = gameRef.current;
    const sfx = getSfx();
    g.over = true;
    g.overReason = null;
    g.armed = false;
    setArmed(false);
    phaseRef.current = "won";
    setPhase("won");
    sfx.win();
    vibrate([30, 60, 30, 60, 80]);
    const L = layoutRef.current;
    for (let i = 0; i < 6; i++) {
      const x = L.boardX + Math.random() * GRID_SIZE * L.cell;
      const y = L.boardY + Math.random() * GRID_SIZE * L.cell;
      spawnBurstAt(g.particles, x, y, FIRE_COLORS, 9);
    }
    const ratio = movesLeftRef.current / level.moves;
    const stars = starsFor(ratio, 3 - g.lives);
    const coins = coinsFor(stars, firstClear);
    setResult({ stars, coins });
    for (let i = 0; i < stars; i++) {
      addTimer(window.setTimeout(() => sfx.star(), 500 + i * 280));
    }
    addTimer(window.setTimeout(() => sfx.coin(), 1400));
    addTimer(window.setTimeout(() => setShowOverlay(true), 800));
  }, [getSfx, level.moves, firstClear]);

  // Поражение
  const loseLevel = useCallback(
    (reason: "bombs" | "stall" | "moves") => {
      const g = gameRef.current;
      const sfx = getSfx();
      g.over = true;
      g.overReason = reason;
      g.armed = false;
      setArmed(false);
      phaseRef.current = "lost";
      setPhase("lost");
      setLoseReason(reason);
      setResult({ stars: 0, coins: 0 });
      sfx.fail();
      vibrate([80, 60, 140]);
      addTimer(window.setTimeout(() => setShowOverlay(true), 450));
    },
    [getSfx],
  );

  // Игровой цикл
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const L = layoutRef.current;
      const canvas = canvasRef.current;
      // фитиль горит и по времени: каждые IDLE_BOMB_TICK (7) секунд простоя — тик;
      // сгорающее кольцо вокруг бомбы делает ровно один оборот за этот период.
      // Пока открыт магазин или «реклама» — время стоит: бомбы не горят
      const paused = shopOpenRef.current || adPlayingRef.current;
      if (!g.over && !paused && g.idleAcc + dt >= IDLE_BOMB_TICK) {
        g.idleAcc = 0;
        const hasBombs =
          boardBombCount(g.grid) > 0 || g.pieces.some((p) => p && p.bombTimer !== null);
        if (hasBombs) {
          const { blown, trayBlown } = tickAllBombs(g, new Set());
          const sfx = getSfx();
          if (blown.length > 0 || trayBlown.length > 0) {
            processExplosions(g, L, sfx, t, blown, trayBlown);
            setLives(g.lives);
            if (g.lives <= 0) {
              loseLevel("bombs");
              setShowOverlay(true);
            }
          } else {
            sfx.tick();
          }
        }
      } else if (!paused) {
        g.idleAcc += dt;
      }
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) drawFrame(ctx, g, L, dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getSfx, loseLevel, t]);

  const placePiece = useCallback(
    (slot: number, piece: Piece, row: number, col: number) => {
      const g = gameRef.current;
      const L = layoutRef.current;
      const sfx = getSfx();
      const mult = scoreMultiplier(level);

      // 1. ставим фигуру (клетка-бомба становится тикающей бомбой на поле)
      g.placements += 1;
      g.idleAcc = 0;
      movesLeftRef.current -= 1;
      setMovesLeft(movesLeftRef.current);
      const freshKeys = new Set<number>();
      piece.shape.cells.forEach(([dr, dc], i) => {
        const r = row + dr;
        const c = col + dc;
        const isBomb = piece.bomb === i && piece.bombTimer !== null;
        g.grid[r][c] = isBomb ? -(piece.bombTimer as number) : piece.color;
        g.pops.push({ r, c, t: 0 });
        freshKeys.add(r * 100 + c);
      });
      g.pieces[slot] = null;
      g.score += Math.round(piece.shape.size * mult);
      sfx.place();
      vibrate(12);

      const { rows, cols } = fullLines(g.grid);
      const lineCount = rows.length + cols.length;
      if (lineCount > 0) {
        const defusedNow = bombsInLines(g.grid, rows, cols);
        // камни остаются на месте — очки только за реально смытые клетки
        let cellsCleared = 0;
        for (const r of rows) {
          for (let c = 0; c < GRID_SIZE; c++) if (!isStone(g.grid[r][c])) cellsCleared++;
        }
        for (const c of cols) {
          for (let r = 0; r < GRID_SIZE; r++) if (!rows.includes(r) && !isStone(g.grid[r][c])) cellsCleared++;
        }
        g.streak += 1;
        g.defused += defusedNow;
        const goalColor = collectGoal(level)?.color ?? -1;
        const res = clearScore(lineCount, cellsCleared, g.streak);
        g.score += Math.round((res.total + defusedNow * 100) * mult);
        g.lines += lineCount;

        // частицы из каждой взорванной клетки + подсчёт сбора цвета цели
        for (const r of rows) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const v = g.grid[r][c];
            if (v === goalColor) g.collected += 1;
            if (!isStone(v)) spawnBurst(g.particles, L, r, c, v);
          }
        }
        for (const c of cols) {
          for (let r = 0; r < GRID_SIZE; r++) {
            if (!rows.includes(r)) {
              const v = g.grid[r][c];
              if (v === goalColor) g.collected += 1;
              if (!isStone(v)) spawnBurst(g.particles, L, r, c, v);
            }
          }
        }
        // центроид взрыва для текста
        let sx = 0;
        let sy = 0;
        let n = 0;
        for (const r of rows) {
          for (let c = 0; c < GRID_SIZE; c++) {
            sx += c;
            sy += r;
            n++;
          }
        }
        for (const c of cols) {
          for (let r = 0; r < GRID_SIZE; r++) {
            if (!rows.includes(r)) {
              sx += c;
              sy += r;
              n++;
            }
          }
        }
        const tcx = L.boardX + (sx / n + 0.5) * L.cell;
        const tcy = L.boardY + (sy / n + 0.5) * L.cell;
        g.texts.push({
          x: tcx,
          y: tcy,
          text: `+${res.total}`,
          color: "#ffd34d",
          size: Math.min(30, 22 + lineCount * 3),
          life: 1.1,
          maxLife: 1.1,
        });
        const word =
          lineCount >= 4
            ? t.mega
            : lineCount === 3
              ? t.triple
              : lineCount === 2
                ? t.double
                : g.streak >= 2
                  ? t.streakText((1 + 0.1 * Math.min(g.streak, 10)).toFixed(1))
                  : null;
        if (word) {
          g.texts.push({
            x: tcx,
            y: tcy - 34,
            text: word,
            color: "#ff9a3d",
            size: 17,
            life: 1.15,
            maxLife: 1.15,
          });
        }
        if (defusedNow > 0) {
          sfx.defuse();
          g.texts.push({
            x: tcx,
            y: tcy - 62,
            text: t.defusedText(defusedNow, defusedNow * 100),
            color: "#7ef0b0",
            size: 15,
            life: 1.2,
            maxLife: 1.2,
          });
        }
        g.shake = Math.min(20, g.shake + 4 + lineCount * 4);
        sfx.clear(lineCount, g.streak);
        vibrate(lineCount >= 2 ? [20, 40, 30] : 25);

        // камни не смываются линией — их берёт только кратер бомбы или молоток
        for (const r of rows) {
          for (let c = 0; c < GRID_SIZE; c++) if (!isStone(g.grid[r][c])) g.grid[r][c] = 0;
        }
        for (const c of cols) {
          for (let r = 0; r < GRID_SIZE; r++) if (!rows.includes(r) && !isStone(g.grid[r][c])) g.grid[r][c] = 0;
        }
      } else {
        g.streak = 0;
      }

      // 3. тик бомб (на поле — кроме свежепоставленных — и в лотке) и взрывы
      const { blown, trayBlown } = tickAllBombs(g, freshKeys);
      processExplosions(g, L, sfx, t, blown, trayBlown);

      // 4. полевая бомба — САМА появляется на пустой клетке (по графику уровня)
      if (Number.isFinite(level.bombsFrom) && g.placements >= g.nextBombAt) {
        const diff = level.diff;
        if (boardBombCount(g.grid) >= MAX_BOARD_BOMBS) {
          g.nextBombAt = g.placements + 1;
        } else {
          const spawned = spawnBoardBomb(g.grid, boardBombTimerFor(diff));
          if (spawned) {
            const [br, bc] = spawned;
            g.pops.push({ r: br, c: bc, t: 0 });
            const bx = L.boardX + (bc + 0.5) * L.cell;
            const by = L.boardY + (br + 0.5) * L.cell;
            g.texts.push({
              x: bx,
              y: by,
              text: t.bombSpawnText,
              color: "#ff5a4d",
              size: 18,
              life: 1.25,
              maxLife: 1.25,
            });
            spawnBurstAt(g.particles, bx, by, FIRE_COLORS, 6);
            sfx.bombSpawn();
            vibrate([20, 45, 20]);
            g.nextBombAt = g.placements + level.bombEvery;
          } else {
            g.nextBombAt = g.placements + 1;
          }
        }
      }

      // 5. пополнение лотка
      if (g.pieces.every((p) => p === null)) {
        g.pieces = piecesFor(level, g.grid, level.pieceBombs && g.placements >= 6);
      }
      refreshDead(g);

      // 6. тревожный тик при почти догоревшем фитиле
      if (!g.over && hasLowBomb(g)) sfx.tick();

      // 7. итог: победа важнее поражения (успел на последнем ходу — молодец)
      const stats = {
        lines: g.lines,
        defused: g.defused,
        collected: g.collected,
        score: g.score,
      };
      if (goalReached(level, stats)) {
        winLevel();
      } else if (g.lives <= 0) {
        loseLevel("bombs");
      } else if (movesLeftRef.current <= 0) {
        loseLevel("moves");
      } else if (!g.pieces.some((p) => p && canPlaceAnywhere(g.grid, p.shape))) {
        loseLevel("stall");
      }

      setScore(g.score);
      setStreak(g.streak);
      setLinesCleared(g.lines);
      setLives(g.lives);
      setDefused(g.defused);
      setCollected(g.collected);
    },
    [getSfx, level, winLevel, loseLevel, t],
  );

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const cellAt = (x: number, y: number) => {
    const L = layoutRef.current;
    const col = Math.floor((x - L.boardX) / L.cell);
    const row = Math.floor((y - L.boardY) / L.cell);
    if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return null;
    return { row, col };
  };

  // Молоток: взводим/снимаем
  const toggleHammer = useCallback(() => {
    const g = gameRef.current;
    if (phaseRef.current !== "play" || boosters.hammer <= 0) return;
    g.armed = !g.armed;
    g.hammerTarget = null;
    g.drag = null;
    setArmed(g.armed);
    getSfx().pickup();
  }, [boosters.hammer, getSfx]);

  // Удар молотком по клетке
  const hammerHit = useCallback(
    (r: number, c: number) => {
      const g = gameRef.current;
      const L = layoutRef.current;
      const sfx = getSfx();
      const mult = scoreMultiplier(level);
      const v = applyHammer(g.grid, r, c);
      if (v === 0) return;
      if (v < 0) {
        g.defused += 1;
        g.score += Math.round(100 * mult);
        g.texts.push({
          x: L.boardX + (c + 0.5) * L.cell,
          y: L.boardY + (r + 0.5) * L.cell,
          text: t.defuse100,
          color: "#7ef0b0",
          size: 14,
          life: 1.1,
          maxLife: 1.1,
        });
        spawnBurst(g.particles, L, r, c, 0);
      } else {
        g.score += Math.round(10 * mult);
        const cg = collectGoal(level);
        if (cg && v === cg.color) g.collected += 1;
        spawnBurst(g.particles, L, r, c, v);
      }
      sfx.hammer();
      vibrate(25);
      g.shake = Math.min(10, g.shake + 6);
      onUseBooster("hammer");
      g.armed = false;
      g.hammerTarget = null;
      setArmed(false);
      setScore(g.score);
      setDefused(g.defused);
      setCollected(g.collected);

      const stats = {
        lines: g.lines,
        defused: g.defused,
        collected: g.collected,
        score: g.score,
      };
      if (goalReached(level, stats)) winLevel();
    },
    [getSfx, level, onUseBooster, winLevel, t],
  );

  // Перемешать лоток
  const useShuffle = useCallback(() => {
    const g = gameRef.current;
    if (phaseRef.current !== "play" || boosters.shuffle <= 0) return;
    const fresh = piecesFor(level, g.grid, level.pieceBombs && g.placements >= 6);
    g.pieces = g.pieces.map((p, i) => (p ? fresh[i] : null));
    refreshDead(g);
    const L = layoutRef.current;
    for (let i = 0; i < 3; i++) {
      spawnBurstAt(g.particles, (L.W / 3) * (i + 0.5), L.trayY + L.trayH / 2, FIRE_COLORS, 5);
    }
    getSfx().shuffle();
    vibrate(15);
    onUseBooster("shuffle");
  }, [boosters.shuffle, getSfx, level, onUseBooster]);

  // +5 ходов
  const usePlus5 = useCallback(() => {
    const g = gameRef.current;
    if (phaseRef.current !== "play" || boosters.plus5 <= 0) return;
    movesLeftRef.current += 5;
    setMovesLeft(movesLeftRef.current);
    const L = layoutRef.current;
    g.texts.push({
      x: L.boardX + (GRID_SIZE / 2) * L.cell,
      y: L.boardY + (GRID_SIZE / 2) * L.cell,
      text: t.plus5Text,
      color: "#ffd34d",
      size: 24,
      life: 1.2,
      maxLife: 1.2,
    });
    getSfx().coin();
    vibrate([15, 30, 15]);
    onUseBooster("plus5");
  }, [boosters.plus5, getSfx, onUseBooster, t]);

  // ── Магазин внутри уровня: покупка, а при нехватке монет — реклама ─────
  const tryBuy = useCallback(
    (kind: BoosterKind) => {
      if (phaseRef.current !== "play") return;
      const price = PRICES[kind];
      if (coins >= price) {
        if (onBuyBooster(kind)) {
          getSfx().coin();
          vibrate(12);
        }
        return;
      }
      // не хватило монет — предлагаем посмотреть рекламу (+adReward)
      startAd(kind);
    },
    [coins, getSfx, onBuyBooster, startAd],
  );

  // Награда за просмотренную рекламу; ждущий бустер докупается сразу
  const claimAd = useCallback(() => {
    if (!adDone) return;
    const kind = adPending;
    const newCoins = onAdReward(adReward);
    getSfx().coin();
    vibrate([15, 30, 15]);
    endAd();
    if (kind && newCoins >= PRICES[kind] && onBuyBooster(kind)) {
      const g = gameRef.current;
      const L = layoutRef.current;
      g.texts.push({
        x: L.boardX + (GRID_SIZE / 2) * L.cell,
        y: L.boardY + 2 * L.cell,
        text: t.adRewarded(adReward),
        color: "#ffd34d",
        size: 18,
        life: 1.4,
        maxLife: 1.4,
      });
    }
  }, [adDone, adPending, adReward, endAd, getSfx, onAdReward, onBuyBooster, t]);

  // закрыть рекламу до конца — без награды
  const abortAd = useCallback(() => {
    endAd();
  }, [endAd]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    if (phaseRef.current !== "play") return;
    const { x, y } = getPos(e);
    const L = layoutRef.current;
    // молоток взведён — тап по блоку сносит его
    if (g.armed) {
      const cell = cellAt(x, y);
      if (cell && g.grid[cell.row][cell.col] !== 0) {
        hammerHit(cell.row, cell.col);
      } else {
        g.armed = false;
        g.hammerTarget = null;
        setArmed(false);
      }
      return;
    }
    if (g.over || g.drag) return;
    if (y < L.trayY - 14) return; // хватать можно только из лотка
    const slot = Math.max(0, Math.min(2, Math.floor(x / (L.W / 3))));
    const piece = g.pieces[slot];
    if (!piece) return;
    if (g.anim && g.anim.slot === slot) g.anim = null;
    const lift = e.pointerType === "touch" ? L.cell * 1.9 : 0;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // синтетические/неактивные указатели — захват не критичен
    }
    getSfx().pickup();
    vibrate(8);
    g.drag = {
      slot,
      piece,
      x,
      y,
      lift,
      t: 0,
      valid: false,
      row: -99,
      col: -99,
      wouldClear: null,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    const { x, y } = getPos(e);
    if (g.armed) {
      const cell = cellAt(x, y);
      g.hammerTarget = cell ? { r: cell.row, c: cell.col } : null;
      return;
    }
    if (!g.drag) return;
    const d = g.drag;
    const L = layoutRef.current;
    d.x = x;
    d.y = y;
    d.t += 0.016;
    const cx = x;
    const cy = y - d.lift;
    const pw = d.piece.shape.w * L.cell;
    const ph = d.piece.shape.h * L.cell;
    const col = Math.round((cx - pw / 2 - L.boardX) / L.cell);
    const row = Math.round((cy - ph / 2 - L.boardY) / L.cell);
    d.valid = canPlace(g.grid, d.piece.shape, row, col);
    if (d.valid) {
      d.row = row;
      d.col = col;
      const sim: Grid = g.grid.map((r) => r.slice());
      for (const [dr, dc] of d.piece.shape.cells) sim[row + dr][col + dc] = d.piece.color;
      d.wouldClear = fullLines(sim);
    } else {
      d.wouldClear = null;
    }
  };

  const onPointerUp = () => {
    const g = gameRef.current;
    if (g.armed) return;
    if (!g.drag) return;
    const d = g.drag;
    g.drag = null;
    const L = layoutRef.current;
    if (d.valid) {
      placePiece(d.slot, d.piece, d.row, d.col);
      return;
    }
    // возврат в лоток с анимацией
    const cx = d.x;
    const cy = d.y - d.lift;
    const overBoard =
      cx > L.boardX - L.cell &&
      cx < L.boardX + GRID_SIZE * L.cell + L.cell &&
      cy > L.boardY - L.cell &&
      cy < L.boardY + GRID_SIZE * L.cell + L.cell;
    if (overBoard) getSfx().bump();
    g.anim = { slot: d.slot, piece: d.piece, x: cx, y: cy, t: 0 };
  };

  // Рестарт уровня
  const restart = useCallback(() => {
    const g = gameRef.current;
    g.grid = emptyGrid();
    if (level.stones > 0) spawnStones(g.grid, level.stones);
    g.pieces = piecesFor(level, g.grid, false);
    g.dead = [false, false, false];
    g.drag = null;
    g.anim = null;
    g.particles = [];
    g.texts = [];
    g.pops = [];
    g.shake = 0;
    g.streak = 0;
    g.score = 0;
    g.lines = 0;
    g.lives = 3;
    g.defused = 0;
    g.placements = 0;
    g.nextBombAt = level.bombsFrom;
    g.idleAcc = 0;
    g.collected = 0;
    g.armed = false;
    g.hammerTarget = null;
    g.overReason = null;
    g.over = false;
    refreshDead(g);
    movesLeftRef.current = level.moves;
    phaseRef.current = "play";
    setScore(0);
    setStreak(0);
    setLinesCleared(0);
    setLives(3);
    setDefused(0);
    setCollected(0);
    setMovesLeft(level.moves);
    setPhase("play");
    setResult(null);
    setShowOverlay(false);
    setArmed(false);
    setLoseReason(null);
    // задачи снова подсвечиваются после рестарта
    setGoalFlash(true);
    addTimer(window.setTimeout(() => setGoalFlash(false), 4000));
    // рестарт возможен и из окна победы (<3 звёзд) — закрываем магазин/рекламу
    closeShop();
    endAd();
  }, [level, closeShop, endAd]);

  const goalChips = goalProgressTexts(level, { lines: linesCleared, defused, collected, score }, lang);

  // товары магазина внутри уровня (цены — из progress.ts)
  const shopItems: { kind: BoosterKind; label: string; icon: typeof Hammer; price: number; count: number; tone: string }[] = [
    { kind: "hammer", label: t.hammer, icon: Hammer, price: PRICES.hammer, count: boosters.hammer, tone: "bg-rose-500" },
    { kind: "shuffle", label: t.shuffle, icon: Shuffle, price: PRICES.shuffle, count: boosters.shuffle, tone: "bg-teal-500" },
    { kind: "plus5", label: `+${t.plus5}`, icon: Plus, price: PRICES.plus5, count: boosters.plus5, tone: "bg-amber-500" },
  ];

  const resultPayload = (won: boolean): LevelResult => ({
    levelN: level.n,
    won,
    stars: won ? (result?.stars ?? 1) : 0,
    coins: won ? (result?.coins ?? 0) : 0,
    firstClear,
  });

  const handleNext = () => onLevelEnd(resultPayload(true), true);
  const handleToMap = () => onLevelEnd(resultPayload(phase === "won"), false);
  const handleRetryToMap = () => onLevelEnd(resultPayload(false), false);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center bg-[#131118] bg-gradient-to-b from-[#1a1723] via-[#141219] to-[#0f0e14] text-white select-none">
      <main className="flex w-full max-w-[420px] flex-1 flex-col px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)]">
        {/* Верхняя строка: выход, жизни, звук */}
        <div className="flex items-center justify-between gap-2 pb-1">
          <button
            type="button"
            onClick={onExit}
            aria-label={t.exitAria}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/70 transition active:scale-90 hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-0.5" aria-label={t.livesAria(lives)}>
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                aria-hidden="true"
                className={`size-4 ${i < lives ? "text-rose-500" : "text-white/15"}`}
                fill={i < lives ? "currentColor" : "none"}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? t.soundOnAria : t.soundOffAria}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/70 transition active:scale-90 hover:bg-white/10"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        {/* Задачи уровня (1-3): на старте подсвечиваются первые ~4 секунды */}
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 pb-1"
          role="status"
          aria-label={t.goalsAria}
        >
          {goalChips.map((gp, i) => {
            const swatch =
              gp.goal.type === "collect" && gp.goal.color ? BLOCK_COLORS[gp.goal.color - 1]?.top : undefined;
            return (
              <div
                key={`${i}-${gp.label}`}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
                  gp.done
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/80"
                } ${goalFlash ? "goal-flash" : ""}`}
                style={goalFlash ? { animationDelay: `${i * 0.12}s` } : undefined}
                aria-label={t.goalAria(gp.label, gp.now, gp.target)}
              >
                {swatch ? (
                  <span
                    className="inline-block size-3.5 shrink-0 rounded-[4px]"
                    style={{ background: swatch }}
                    aria-hidden="true"
                  />
                ) : gp.goal.type === "defuse" ? (
                  <Bomb className="size-4 shrink-0 text-rose-400" aria-hidden="true" />
                ) : gp.goal.type === "score" ? (
                  <Star className="size-4 shrink-0 text-amber-400" aria-hidden="true" />
                ) : (
                  <Flame className="size-4 shrink-0 text-orange-400" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {gp.label} {gp.now}/{gp.target}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ходы и очки */}
        <div className="flex items-end justify-between px-1 pb-2 pt-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/35">{t.moves}</div>
            <div
              key={movesLeft}
              className={`score-pop text-4xl font-black leading-none tabular-nums ${
                movesLeft <= 5 ? "text-rose-400" : "text-white"
              }`}
            >
              {Math.max(0, movesLeft)}
            </div>
          </div>
          {streak >= 2 && (
            <div
              className="mb-1 flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1.5 text-xs font-bold text-orange-300"
              role="status"
            >
              <Flame className="size-4" aria-hidden="true" />
              {t.streakChip((1 + 0.1 * Math.min(streak, 10)).toFixed(1))}
            </div>
          )}
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-white/35">{t.score}</div>
            <div key={score} className="score-pop text-2xl font-black leading-none text-amber-300 tabular-nums">
              {score}
            </div>
          </div>
        </div>

        {/* Игровое поле */}
        <div ref={wrapRef} className="relative w-full">
          <canvas
            ref={canvasRef}
            className={`block w-full touch-none ${armed ? "cursor-crosshair" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t.boardAria}
          />

          {showOverlay && phase === "won" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-[86%] max-w-xs rounded-2xl border border-amber-400/20 bg-[#1c1a24] p-6 text-center shadow-2xl">
                <div className="text-xs uppercase tracking-widest text-white/40">
                  {t.levelComplete(level.n)}
                </div>
                <div className="mt-3 flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <Star
                      key={`${i}-${result?.stars}`}
                      aria-hidden="true"
                      className={`size-10 star-pop ${i < (result?.stars ?? 0) ? "text-amber-400" : "text-white/15"}`}
                      fill={i < (result?.stars ?? 0) ? "currentColor" : "none"}
                      style={{ animationDelay: `${i * 0.22}s` }}
                    />
                  ))}
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">
                  <Coins className="size-3.5" aria-hidden="true" />
                  {t.coinsReward(result?.coins ?? 0)}
                </div>
                <div className="mt-2 text-xs text-white/40">{t.winStats(score, movesLeft, defused)}</div>
                <button
                  type="button"
                  onClick={handleNext}
                  className="mt-5 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-base font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95"
                >
                  {t.nextLevel}
                </button>
                {/* меньше 3 звёзд — небольшая кнопка повтора, чтобы улучшить результат */}
                {(result?.stars ?? 0) < 3 ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={restart}
                      aria-label={t.retryImprove}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 py-2 text-sm font-bold text-amber-300 transition active:scale-95 hover:bg-amber-400/20"
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                      {t.retryImprove}
                    </button>
                    <button
                      type="button"
                      onClick={handleToMap}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/70 transition active:scale-95 hover:bg-white/10"
                    >
                      {t.toMap}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleToMap}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/70 transition active:scale-95 hover:bg-white/10"
                  >
                    {t.toMap}
                  </button>
                )}
              </div>
            </div>
          )}

          {showOverlay && phase === "lost" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-6 text-center shadow-2xl">
                <div className="text-xs uppercase tracking-widest text-rose-300/70">
                  {t.levelFailed(level.n)}
                </div>
                <div className="mt-2 text-xl font-black text-white">
                  {loseReason === "moves" ? t.loseMoves : loseReason === "bombs" ? t.loseBombs : t.loseStall}
                </div>
                <div className="mt-2 text-xs text-white/40">
                  {goalChips.map((gp, i) => (
                    <div key={i}>{t.goalLine(gp.label, gp.now, gp.target)}</div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={restart}
                  className="mt-5 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-base font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t.retry}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleRetryToMap}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/70 transition active:scale-95 hover:bg-white/10"
                >
                  {t.toMap}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Бустеры + магазин */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={toggleHammer}
            disabled={boosters.hammer <= 0 || phase !== "play"}
            aria-label={t.hammerAria(boosters.hammer)}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition active:scale-95 disabled:opacity-35 ${
              armed
                ? "border-rose-400/60 bg-rose-500/20 text-rose-300"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <Hammer className="size-4" aria-hidden="true" />
            {t.hammer}
            {boosters.hammer > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                {boosters.hammer}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={useShuffle}
            disabled={boosters.shuffle <= 0 || phase !== "play"}
            aria-label={t.shuffleAria(boosters.shuffle)}
            className="relative flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/70 transition active:scale-95 hover:bg-white/10 disabled:opacity-35"
          >
            <Shuffle className="size-4" aria-hidden="true" />
            {t.shuffle}
            {boosters.shuffle > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-teal-500 text-[10px] font-black text-white">
                {boosters.shuffle}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={usePlus5}
            disabled={boosters.plus5 <= 0 || phase !== "play"}
            aria-label={t.plus5Aria(boosters.plus5)}
            className="relative flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white/70 transition active:scale-95 hover:bg-white/10 disabled:opacity-35"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.plus5}
            {boosters.plus5 > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-amber-500 text-[10px] font-black text-white">
                {boosters.plus5}
              </span>
            )}
          </button>
          {/* магазин внутри уровня: покупка бустеров, не выходя в меню */}
          <button
            type="button"
            onClick={openShop}
            disabled={phase !== "play"}
            aria-label={t.shopAria}
            className="relative flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 py-2.5 text-xs font-bold text-amber-300 transition active:scale-95 hover:bg-amber-400/20 disabled:opacity-35"
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            {t.shop}
            <span
              className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white tabular-nums"
              aria-hidden="true"
            >
              {coins}
            </span>
          </button>
        </div>

        {/* ── Магазин внутри уровня ─────────────────────────────────────── */}
        {shopOpen && phase === "play" && !adPlaying && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={t.shopAria}
          >
            <div className="w-[88%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black uppercase tracking-widest text-white/70">{t.shop}</div>
                <div
                  className="flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-sm font-black text-amber-300 tabular-nums"
                  aria-label={t.shopCoinsAria(coins)}
                >
                  <Coins className="size-4" aria-hidden="true" />
                  {coins}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {shopItems.map(({ kind, label, icon: Icon, price, count, tone }) => {
                  const afford = coins >= price;
                  return (
                    <div
                      key={kind}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <span className="relative shrink-0">
                        <span className={`grid size-10 place-items-center rounded-lg ${tone}`}>
                          <Icon className="size-5 text-white" aria-hidden="true" />
                        </span>
                        <span
                          className="absolute -right-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black"
                          aria-label={t.have(count)}
                        >
                          {count}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white/85">{label}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs font-black text-amber-300 tabular-nums">
                          <Coins className="size-3" aria-hidden="true" />
                          {price}
                        </div>
                        {!afford && (
                          <div className="mt-0.5 whitespace-nowrap text-[11px] leading-tight text-rose-300/80" aria-label={t.needed(price - coins)}>
                            {t.needed(price - coins)}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => tryBuy(kind)}
                        aria-label={afford ? t.buyAria(label, price, count) : t.adCtaAria(adReward)}
                        className={
                          afford
                            ? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 px-3.5 py-2 text-xs font-black text-[#221a08] shadow-md shadow-orange-950/40 transition active:scale-95"
                            : "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-teal-400/40 bg-teal-400/10 px-3.5 py-2 text-xs font-black text-teal-300 transition active:scale-95 hover:bg-teal-400/20"
                        }
                      >
                        {afford ? (
                          <>
                            <Coins className="size-3.5" aria-hidden="true" />
                            {t.buy}
                          </>
                        ) : (
                          <>
                            <Video className="size-3.5" aria-hidden="true" />
                            {t.adCta(adReward)}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={closeShop}
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/70 transition active:scale-95 hover:bg-white/10"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {/* ── «Реклама» за монеты (демо: сюда позже встанет реальный ролик) ── */}
        {adPlaying && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label={t.adTitle}
          >
            <button
              type="button"
              onClick={abortAd}
              aria-label={t.adCloseAria}
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 transition active:scale-90 hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
            <div className="w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#14121b] p-5 text-center shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/35">{t.adTitle}</div>
              <div className="mt-3 grid h-36 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 animate-pulse">
                <div className="flex flex-col items-center gap-1.5 text-white">
                  <Bomb className="size-10" aria-hidden="true" />
                  <div className="text-lg font-black tracking-wide">{t.appName}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] leading-snug text-white/40">{t.adNote}</div>
              <div className="mt-4" aria-hidden="true">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(1 - adLeft / (AD_SECONDS * 1000)) * 100}%` }}
                  />
                </div>
                <div className="mt-1.5 text-xs font-bold tabular-nums text-white/50">
                  {t.adSeconds(Math.ceil(adLeft / 1000))}
                </div>
              </div>
              <button
                type="button"
                onClick={claimAd}
                disabled={!adDone}
                className="mt-4 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-sm font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95 disabled:opacity-40"
              >
                {t.adClaim(adReward)}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Тик всех бомб: на поле (skip — свежепоставленные) и в лотке */
function tickAllBombs(
  g: GameState,
  skip: Set<number>,
): { blown: [number, number][]; trayBlown: number[] } {
  const blown = tickBoardBombs(g.grid, skip);
  const trayBlown: number[] = [];
  g.pieces.forEach((p, i) => {
    if (p && p.bomb !== null && p.bombTimer !== null) {
      p.bombTimer -= 1;
      if (p.bombTimer <= 0) trayBlown.push(i);
    }
  });
  return { blown, trayBlown };
}

/** Взрывы бомб: -1 жизнь за каждую, кратер 3x3 на поле, частицы и тряска */
function processExplosions(
  g: GameState,
  L: LayoutMetrics,
  sfx: Sfx,
  t: Strings,
  blown: [number, number][],
  trayBlown: number[],
): void {
  if (blown.length === 0 && trayBlown.length === 0) return;
  sfx.explode();
  vibrate([90, 50, 120]);
  g.shake = Math.min(26, g.shake + 20);
  for (const [r, c] of blown) {
    const bx = L.boardX + (c + 0.5) * L.cell;
    const by = L.boardY + (r + 0.5) * L.cell;
    spawnBurstAt(g.particles, bx, by, FIRE_COLORS, 16);
    for (const [cr, cc, vOld] of explodeCrater(g.grid, r, c)) {
      spawnBurst(g.particles, L, cr, cc, vOld > 0 ? vOld : 0);
    }
    g.texts.push({ x: bx, y: by, text: t.minusLife, color: "#ff5a4d", size: 20, life: 1.2, maxLife: 1.2 });
    g.lives -= 1;
  }
  for (const i of trayBlown) {
    g.pieces[i] = null;
    const bx = (L.W / 3) * (i + 0.5);
    const by = L.trayY + L.trayH / 2;
    spawnBurstAt(g.particles, bx, by, FIRE_COLORS, 14);
    g.texts.push({ x: bx, y: by, text: t.minusLife, color: "#ff5a4d", size: 17, life: 1.2, maxLife: 1.2 });
    g.lives -= 1;
  }
}

// ── Кадр отрисовки ──────────────────────────────────────────────────────────

function drawFrame(ctx: CanvasRenderingContext2D, g: GameState, L: LayoutMetrics, dt: number): void {
  g.time += dt;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);

  // тряска экрана
  g.shake = Math.max(0, g.shake - dt * 55);
  if (g.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
  }

  // возраст «попов»
  for (let i = g.pops.length - 1; i >= 0; i--) {
    g.pops[i].t += dt;
    if (g.pops[i].t > 0.3) g.pops.splice(i, 1);
  }

  drawBoard(ctx, g, L);

  if (!g.over) {
    if (hasLowBomb(g)) {
      drawFireBorder(ctx, L, g.time, "danger");
    } else if (g.streak >= 3) {
      drawFireBorder(ctx, L, g.time, "fire");
    }
  }

  drawTray(ctx, g, L);

  // прицел молотка
  if (g.armed && g.hammerTarget) {
    drawHammerTarget(ctx, L, g.hammerTarget.r, g.hammerTarget.c, g.time);
  }

  // возврат фигуры в лоток
  if (g.anim) {
    g.anim.t += dt;
    const k = Math.min(1, g.anim.t / 0.17);
    const e = easeOutCubic(k);
    const slotW = L.W / 3;
    const tx = slotW * (g.anim.slot + 0.5);
    const ty = L.trayY + L.trayH / 2;
    const cx = g.anim.x + (tx - g.anim.x) * e;
    const cy = g.anim.y + (ty - g.anim.y) * e;
    const scale = 1 + (TRAY_SCALE - 1) * e;
    if (k >= 1) g.anim = null;
    else drawPieceAt(ctx, g.anim.piece, cx, cy, L.cell, scale, 1, g.time, g.goalColor, idleRing(g));
  }

  // фигура в руке
  if (g.drag) {
    const d = g.drag;
    const k = easeOutCubic(Math.min(1, d.t / 0.12));
    const scale = TRAY_SCALE + (1 - TRAY_SCALE) * k;
    if (d.valid) {
      drawClearPreview(ctx, d, L);
      drawGhost(ctx, d, L, g.time);
    }
    const cx = d.x;
    const cy = d.y - d.lift;
    // тень под фигурой
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    const w = d.piece.shape.w * L.cell * scale;
    const h = d.piece.shape.h * L.cell * scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy + h / 2 + 6, w * 0.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPieceAt(ctx, d.piece, cx, cy, L.cell, scale, 1, g.time, undefined, idleRing(g));
  }

  updateParticles(ctx, g.particles, dt);
  updateTexts(ctx, g.texts, dt);
}
