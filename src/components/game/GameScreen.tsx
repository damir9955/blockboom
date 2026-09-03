"use client";

// ── Экран уровня: HUD с целями, поле, бустеры, магазин, реклама, оверлеи ─────

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
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
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  applyHammer,
  BLOCK_COLORS,
  boardBombCount,
  boardBombTimerFor,
  bombsInLines,
  canPlace,
  canPlaceAnywhere,
  clearScore,
  emptyGrid,
  explodeCrater,
  fullLines,
  generatePieces,
  GRID_SIZE,
  hitStone,
  isStone,
  MAX_BOARD_BOMBS,
  spawnBoardBomb,
  spawnStones,
  stoneStage,
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
  fuseFraction,
  hasLowBomb,
  IDLE_BOMB_TICK,
  spawnBurst,
  spawnBurstAt,
  STONE_COLORS,
  TRAY_SCALE,
  updateParticles,
  updateTexts,
  type DragState,
  type GameState,
  type LayoutMetrics,
} from "./render";
import {
  allGoalsReached,
  collectGoalOf,
  goalProgressList,
  levelHint,
  scoreMultiplier,
  starsFor,
  coinsFor,
  type GoalStats,
  type LevelDef,
} from "./levels";
import { tr, type Lang, type Strings } from "./i18n";
import { PRICES, type BoosterKind, type TipKind } from "./progress";
import CoinsModal from "./CoinsModal";
import ToolModal from "./ToolModal";
import TipOverlay from "./TipOverlay";

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
  coins: number;
  muted: boolean;
  lang: Lang;
  /** уже показанные игроку краткие подсказки */
  tips: Record<TipKind, boolean>;
  onToggleMute: () => void;
  onUseBooster: (kind: BoosterKind) => void;
  onBuyBooster: (kind: BoosterKind) => boolean;
  onAdReward: (n: number) => void;
  adReward: number;
  /** отметить подсказку показанной (сохраняется в прогресс) */
  onTipSeen: (kind: TipKind) => void;
  onLevelEnd: (result: LevelResult, goNext: boolean) => void;
  onExit: () => void;
}

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
    fuseAcc: 0,
    collected: 0,
    goalColor: collectGoalOf(level)?.color,
    armed: false,
    hammerTarget: null,
    overReason: null,
    over: false,
  };
}

function refreshDead(g: GameState): void {
  g.dead = g.pieces.map((p) => (p ? !canPlaceAnywhere(g.grid, p.shape) : false));
}

/** Пересчитать прицел фигуры в руке (вызывается из pointermove и после взрывов) */
function updateDragTarget(g: GameState, L: LayoutMetrics): void {
  const d = g.drag;
  if (!d) return;
  const cx = d.x;
  const cy = d.y - d.lift;
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
}

/** Тик всех бомб: на поле (skip — свежепоставленные) и в лотке */
function tickAllBombs(g: GameState, skip: Set<number>): { blown: [number, number][]; trayBlown: number[] } {
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
      spawnBurst(g.particles, L, cr, cc, vOld > 0 && !isStone(vOld) ? vOld : 0);
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
    else drawPieceAt(ctx, g.anim.piece, cx, cy, L.cell, scale, 1, g.time);
  }

  // фигура в руке (фитиль её бомбы продолжает гореть — ring передаём)
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
    drawPieceAt(ctx, d.piece, cx, cy, L.cell, scale, 1, g.time, g.goalColor, fuseFraction(g));
  }

  updateParticles(ctx, g.particles, dt);
  updateTexts(ctx, g.texts, dt);
}

export default function GameScreen({
  level,
  firstClear,
  boosters,
  coins,
  muted,
  lang,
  tips,
  onToggleMute,
  onUseBooster,
  onBuyBooster,
  onAdReward,
  adReward,
  onTipSeen,
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
  /** какие оверлеи открыты — на них игра на паузе (фитиль не горит) */
  const uiRef = useRef({ tip: null as TipKind | null, tool: null as BoosterKind | null, coins: false });
  const tipsRef = useRef(tips);

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
  const [goalsFlash, setGoalsFlash] = useState(true);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [toolKind, setToolKind] = useState<BoosterKind | null>(null);
  // краткая подсказка при старте: уровень 1 — «как играть», первый уровень с камнями — про камни
  const [tip, setTip] = useState<TipKind | null>(() => {
    if (level.n === 1 && !tips.start) return "start";
    if (level.stones > 0 && !tips.stone) return "stone";
    return null;
  });

  const getSfx = useCallback((): Sfx => {
    if (!sfxRef.current) sfxRef.current = new Sfx();
    sfxRef.current.muted = muted;
    return sfxRef.current;
  }, [muted]);

  const addTimer = (id: number) => {
    timersRef.current.push(id);
  };

  // Инициализация: фигуры сразу; вспышка целей гаснет через ~7.5 секунд
  useEffect(() => {
    const g = gameRef.current;
    g.pieces = generatePieces(g.grid, level.diff, false, g.goalColor);
    refreshDead(g);
    const id = window.setTimeout(() => setGoalsFlash(false), 7600);
    return () => {
      window.clearTimeout(id);
      timersRef.current.forEach((tid) => window.clearTimeout(tid));
      timersRef.current = [];
    };
  }, [level]);

  // Синхронизация mute
  useEffect(() => {
    if (sfxRef.current) sfxRef.current.muted = muted;
  }, [muted]);

  // Синхронизация подсказок и открытых оверлеев с рефами (пауза игрового цикла)
  useEffect(() => {
    tipsRef.current = tips;
    uiRef.current.tip = tip;
  }, [tips, tip]);
  useEffect(() => {
    uiRef.current.tool = toolKind;
  }, [toolKind]);
  useEffect(() => {
    uiRef.current.coins = coinsOpen;
  }, [coinsOpen]);

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
          phase: phaseRef.current,
          over: g.over,
          reason: g.overReason,
          fuseAcc: Math.round(g.fuseAcc * 100) / 100,
          stones: g.grid.flat().filter((v) => isStone(v)).length,
          stoneStages: g.grid.flat().filter((v) => isStone(v)).map((v) => stoneStage(v)),
          pieces: g.pieces.map((p) =>
            p ? { w: p.shape.w, h: p.shape.h, cells: p.shape.cells.map(([r, c]) => [r, c]) } : null,
          ),
          grid: g.grid.map((r) => r.slice()),
        };
      };
    }
  }, []);

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
    g.drag = null;
    g.anim = null;
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
    const coinsWon = coinsFor(stars, firstClear);
    setResult({ stars, coins: coinsWon });
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
      g.drag = null;
      g.anim = null;
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

  // Игровой цикл.
  // ВАЖНО (фикс фитиля): кольцо фитиля движется от g.fuseAcc, который копится
  // каждый кадр — в том числе когда фигура в руке. Пауза только там, где
  // игрок не видит поле: победа/поражение, магазин, реклама.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const L = layoutRef.current;
      const canvas = canvasRef.current;
      // Пауза: победа/поражение или любой открытый оверлей (подсказка/панель/монеты/реклама)
      const ui = uiRef.current;
      const blocked = g.over || ui.tip !== null || ui.tool !== null || ui.coins;
      if (!blocked) {
        g.fuseAcc += dt;
        // фитиль сгорел на круг: тик бомб (и во время драга — «сидеть» на бомбе нельзя)
        if (g.fuseAcc >= IDLE_BOMB_TICK) {
          g.fuseAcc = 0;
          const hasBombs =
            boardBombCount(g.grid) > 0 || g.pieces.some((p) => p && p.bombTimer !== null);
          if (hasBombs) {
            const { blown, trayBlown } = tickAllBombs(g, new Set());
            if (blown.length > 0 || trayBlown.length > 0) {
              processExplosions(g, L, getSfx(), t, blown, trayBlown);
              setLives(g.lives);
              // взрыв мог изменить поле под фигурой в руке — пересчитываем прицел
              if (g.drag) updateDragTarget(g, L);
              refreshDead(g);
              if (g.lives <= 0) {
                loseLevel("bombs");
                setShowOverlay(true);
              }
            } else {
              getSfx().tick();
            }
          }
        }
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
      g.fuseAcc = 0; // ход тикнул все фитили — круг начинается заново
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
        // 2. бомбы в линиях обезвреживаются (без взрыва и потери жизни)
        const defusedNow = bombsInLines(g.grid, rows, cols);
        // камни в линиях: каждый получает один удар
        const stoneHits: { r: number; c: number; destroyed: boolean }[] = [];
        const seen = new Set<number>();
        const checkStone = (r: number, c: number) => {
          const k = r * 100 + c;
          if (!seen.has(k) && isStone(g.grid[r][c])) {
            seen.add(k);
            stoneHits.push({ r, c, destroyed: g.grid[r][c] === 97 });
          }
        };
        for (const r of rows) for (let c = 0; c < GRID_SIZE; c++) checkStone(r, c);
        for (const c of cols) for (let r = 0; r < GRID_SIZE; r++) if (!rows.includes(r)) checkStone(r, c);
        // очки: не-камни + разрушенные камни
        let cellsCleared = 0;
        for (const r of rows) for (let c = 0; c < GRID_SIZE; c++) if (!isStone(g.grid[r][c])) cellsCleared++;
        for (const c of cols)
          for (let r = 0; r < GRID_SIZE; r++) if (!rows.includes(r) && !isStone(g.grid[r][c])) cellsCleared++;
        cellsCleared += stoneHits.filter((s) => s.destroyed).length;

        g.streak += 1;
        g.defused += defusedNow;
        const goalColor = collectGoalOf(level)?.color ?? -1;
        const res = clearScore(lineCount, cellsCleared, g.streak);
        g.score += Math.round((res.total + 100 * defusedNow) * mult);
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
        // осколки камней
        for (const s of stoneHits) {
          spawnBurstAt(
            g.particles,
            L.boardX + (s.c + 0.5) * L.cell,
            L.boardY + (s.r + 0.5) * L.cell,
            STONE_COLORS,
            s.destroyed ? 10 : 5,
          );
        }
        if (stoneHits.length > 0) {
          sfx.stoneCrack(stoneHits.some((s) => s.destroyed));
          vibrate(stoneHits.some((s) => s.destroyed) ? [25, 30, 40] : 18);
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
            text: t.defusedText(defusedNow, 100 * defusedNow),
            color: "#7ef0b0",
            size: 15,
            life: 1.2,
            maxLife: 1.2,
          });
        }
        g.shake = Math.min(20, g.shake + 4 + lineCount * 4);
        sfx.clear(lineCount, g.streak);
        vibrate(lineCount >= 2 ? [20, 40, 30] : 25);

        // очистка: камни получают удар (разрушение со 2-го), остальное — 0
        for (const r of rows) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (isStone(g.grid[r][c])) hitStone(g.grid, r, c);
            else g.grid[r][c] = 0;
          }
        }
        for (const c of cols) {
          for (let r = 0; r < GRID_SIZE; r++) {
            if (!rows.includes(r)) {
              if (isStone(g.grid[r][c])) hitStone(g.grid, r, c);
              else g.grid[r][c] = 0;
            }
          }
        }
      } else {
        g.streak = 0;
      }

      // 3. тик бомб (на поле — кроме свежепоставленных — и в лотке) и взрывы
      const { blown, trayBlown } = tickAllBombs(g, freshKeys);
      processExplosions(g, L, sfx, t, blown, trayBlown);

      // 4. полевая бомба — САМА появляется на пустой клетке (по графику уровня)
      if (Number.isFinite(level.bombsFrom) && g.placements >= g.nextBombAt) {
        if (boardBombCount(g.grid) >= MAX_BOARD_BOMBS) {
          g.nextBombAt = g.placements + 1;
        } else {
          const spawned = spawnBoardBomb(g.grid, boardBombTimerFor(level.diff));
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
        g.pieces = generatePieces(
          g.grid,
          level.diff,
          level.pieceBombs && g.placements >= 6,
          g.goalColor,
        );
      }
      refreshDead(g);

      // 5.5 первая бомба — краткая подсказка (один раз)
      if (
        !tipsRef.current.bomb &&
        (boardBombCount(g.grid) > 0 || g.pieces.some((p) => p && p.bombTimer !== null))
      ) {
        setTip("bomb");
      }

      // 6. тревожный тик при почти догоревшем фитиле
      if (!g.over && hasLowBomb(g)) sfx.tick();

      // 7. итог: победа важнее поражения (успел на последнем ходу — молодец)
      const stats: GoalStats = {
        lines: g.lines,
        defused: g.defused,
        collected: g.collected,
        score: g.score,
      };
      if (allGoalsReached(level, stats)) {
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

  // Удар молотком по клетке (камень разбивает целиком — сила бустера)
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
        g.score += Math.round(12 * mult);
        const goal = collectGoalOf(level);
        if (goal && v === goal.color) g.collected += 1;
        spawnBurst(g.particles, L, r, c, isStone(v) ? 0 : v);
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

      const stats: GoalStats = {
        lines: g.lines,
        defused: g.defused,
        collected: g.collected,
        score: g.score,
      };
      if (allGoalsReached(level, stats)) winLevel();
    },
    [getSfx, level, onUseBooster, winLevel, t],
  );

  // Перемешать лоток
  const doShuffle = useCallback(() => {
    const g = gameRef.current;
    if (phaseRef.current !== "play" || boosters.shuffle <= 0) return;
    const fresh = generatePieces(
      g.grid,
      level.diff,
      level.pieceBombs && g.placements >= 6,
      g.goalColor,
    );
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
  const doPlus5 = useCallback(() => {
    const g = gameRef.current;
    if (phaseRef.current !== "play" || boosters.plus5 <= 0) return;
    movesLeftRef.current += 5;
    setMovesLeft(movesLeftRef.current);
    const L = layoutRef.current;
    g.texts.push({
      x: L.boardX + 4 * L.cell,
      y: L.boardY + 4 * L.cell,
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

  // ── Монеты / инструмент / подсказки ──────────────────────────────────────────
  // покупка инструмента из панели (монеты могли прийти за рекламу)
  const handleToolBuy = useCallback(
    (kind: BoosterKind): boolean => {
      const ok = onBuyBooster(kind);
      if (ok) {
        getSfx().coin();
        vibrate(12);
      }
      return ok;
    },
    [getSfx, onBuyBooster],
  );

  // награда за рекламу (модалки монет/инструмента)
  const handleAdReward = useCallback(
    (n: number) => {
      onAdReward(n);
      getSfx().coin();
      vibrate([15, 30, 15]);
    },
    [getSfx, onAdReward],
  );

  // закрыть подсказку и отметить её показанной навсегда
  const dismissTip = useCallback(() => {
    const kind = tip;
    if (!kind) return;
    setTip(null);
    onTipSeen(kind);
  }, [onTipSeen, tip]);

  // ── Указатель ─────────────────────────────────────────────────────────────
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
    updateDragTarget(g, L);
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
    g.pieces = generatePieces(g.grid, level.diff, false, g.goalColor);
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
    g.fuseAcc = 0;
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
    setGoalsFlash(true);
    addTimer(window.setTimeout(() => setGoalsFlash(false), 7600));
    setCoinsOpen(false);
    setToolKind(null);
    setTip(null);
  }, [level]);

  const goals = goalProgressList(level, { lines: linesCleared, defused, collected, score }, lang);

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

  const toolItems: { kind: BoosterKind; label: string; Icon: ElementType; price: number; tone: string }[] = [
    { kind: "hammer", label: t.hammer, Icon: Hammer, price: PRICES.hammer, tone: "bg-rose-500" },
    { kind: "shuffle", label: t.shuffle, Icon: Shuffle, price: PRICES.shuffle, tone: "bg-teal-500" },
    { kind: "plus5", label: `+${t.plus5}`, Icon: Plus, price: PRICES.plus5, tone: "bg-amber-500" },
  ];
  const toolItem = toolItems.find((i) => i.kind === toolKind) ?? null;
  const ToolIcon = toolItem?.Icon;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center bg-[#131118] bg-gradient-to-b from-[#1a1723] via-[#141219] to-[#0f0e14] text-white select-none">
      <main className="flex w-full max-w-[420px] flex-1 flex-col px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)]">
        {/* Верхняя строка: выход, жизни, монеты, звук */}
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
                className={`size-5 ${i < lives ? "text-rose-500" : "text-white/15"}`}
                fill={i < lives ? "currentColor" : "none"}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCoinsOpen(true)}
              aria-label={t.coinsOpenAria}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-sm font-black text-amber-300 tabular-nums transition active:scale-90 hover:bg-amber-400/20"
            >
              <Coins className="size-4" aria-hidden="true" />
              <span key={coins} className="score-pop">{coins}</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? t.soundOnAria : t.soundOffAria}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/70 transition active:scale-90 hover:bg-white/10"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
        </div>

        {/* Номер уровня */}
        <div className="pb-0.5 text-center text-[11px] font-bold uppercase tracking-widest text-white/50">
          {t.levelNChip(level.n)}
        </div>

        {/* Цели уровня — крупно, с долгой вспышкой */}
        <div
          className="flex flex-wrap items-center justify-center gap-2.5 pb-2"
          role="status"
          aria-label={t.goalsAria}
        >
          {goals.map((gl, i) => {
            const swatch =
              gl.goal.type === "collect" && gl.goal.color ? BLOCK_COLORS[gl.goal.color - 1]?.top : undefined;
            return (
              <div
                key={`${i}-${gl.label}`}
                className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-base font-black ${
                  gl.done
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/85"
                } ${goalsFlash ? "goal-flash" : ""}`}
                style={goalsFlash ? { animationDelay: `${0.15 * i}s` } : undefined}
                aria-label={t.goalAria(gl.label, gl.now, gl.target)}
              >
                {swatch ? (
                  <span
                    className="inline-block size-5 shrink-0 rounded-[5px] shadow-sm"
                    style={{ background: swatch }}
                    aria-hidden="true"
                  />
                ) : gl.goal.type === "defuse" ? (
                  <Bomb className="size-6 shrink-0 text-rose-400" aria-hidden="true" />
                ) : gl.goal.type === "score" ? (
                  <Star className="size-6 shrink-0 text-amber-400" aria-hidden="true" />
                ) : (
                  <Flame className="size-6 shrink-0 text-orange-400" aria-hidden="true" />
                )}
                <span className="tabular-nums">
                  {gl.label} <span className={gl.done ? "" : "text-white/50"}>{gl.now}</span>/{gl.target}
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
            aria-label={`${t.boardAria}. ${levelHint(level, lang)}`}
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
                  {goals.map((gl, i) => (
                    <div key={i}>{t.goalLine(gl.label, gl.now, gl.target)}</div>
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

        {/* Инструменты: крупные, с цветной подсветкой; если нет — панель покупки/рекламы */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => (boosters.hammer > 0 ? toggleHammer() : setToolKind("hammer"))}
            disabled={phase !== "play"}
            aria-label={boosters.hammer > 0 ? t.hammerAria(boosters.hammer) : t.buyAria(t.hammer, PRICES.hammer, 0)}
            className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border py-3 text-xs font-black transition active:scale-95 disabled:opacity-35 ${
              armed
                ? "border-rose-300/70 bg-gradient-to-b from-rose-500/40 to-rose-500/10 text-rose-200 shadow-lg shadow-rose-950/40 ring-2 ring-rose-400/40"
                : "border-rose-400/30 bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-200/90 hover:from-rose-500/25"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Hammer className="size-5" aria-hidden="true" />
              {t.hammer}
            </span>
            {boosters.hammer > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-rose-500 text-[11px] font-black text-white shadow-md">
                {boosters.hammer}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300 tabular-nums">
                <Coins className="size-3" aria-hidden="true" />
                {PRICES.hammer}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => (boosters.shuffle > 0 ? doShuffle() : setToolKind("shuffle"))}
            disabled={phase !== "play"}
            aria-label={boosters.shuffle > 0 ? t.shuffleAria(boosters.shuffle) : t.buyAria(t.shuffle, PRICES.shuffle, 0)}
            className="relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-teal-400/30 bg-gradient-to-b from-teal-500/15 to-teal-500/5 py-3 text-xs font-black text-teal-200/90 transition active:scale-95 hover:from-teal-500/25 disabled:opacity-35"
          >
            <span className="flex items-center gap-1.5">
              <Shuffle className="size-5" aria-hidden="true" />
              {t.shuffle}
            </span>
            {boosters.shuffle > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-teal-500 text-[11px] font-black text-white shadow-md">
                {boosters.shuffle}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300 tabular-nums">
                <Coins className="size-3" aria-hidden="true" />
                {PRICES.shuffle}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => (boosters.plus5 > 0 ? doPlus5() : setToolKind("plus5"))}
            disabled={phase !== "play"}
            aria-label={boosters.plus5 > 0 ? t.plus5Aria(boosters.plus5) : t.buyAria(`+${t.plus5}`, PRICES.plus5, 0)}
            className="relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-500/15 to-amber-500/5 py-3 text-xs font-black text-amber-200/90 transition active:scale-95 hover:from-amber-500/25 disabled:opacity-35"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-5" aria-hidden="true" />
              {t.plus5}
            </span>
            {boosters.plus5 > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-amber-500 text-[11px] font-black text-white shadow-md">
                {boosters.plus5}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300 tabular-nums">
                <Coins className="size-3" aria-hidden="true" />
                {PRICES.plus5}
              </span>
            )}
          </button>
        </div>
      </main>

      {/* Краткая подсказка (старт/бомба/камень) — игра на паузе */}
      {tip !== null && <TipOverlay lang={lang} kind={tip} onDismiss={dismissTip} />}

      {/* Монеты: баланс и пополнение за рекламу */}
      {coinsOpen && (
        <CoinsModal
          lang={lang}
          coins={coins}
          reward={adReward}
          onAdReward={handleAdReward}
          onClose={() => setCoinsOpen(false)}
        />
      )}

      {/* Панель инструмента: купить за монеты или рекламу (автопокупки нет) */}
      {toolItem && ToolIcon && (
        <ToolModal
          lang={lang}
          label={toolItem.label}
          Icon={ToolIcon}
          tone={toolItem.tone}
          price={toolItem.price}
          count={boosters[toolItem.kind]}
          coins={coins}
          reward={adReward}
          onBuy={() => {
            if (handleToolBuy(toolItem.kind)) setToolKind(null);
          }}
          onAdReward={handleAdReward}
          onClose={() => setToolKind(null)}
        />
      )}
    </div>
  );
}
