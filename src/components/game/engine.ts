// ── БЛОК БУМ: игровой движок (чистая логика без React) ──────────────────────

export const GRID_SIZE = 8;
export const COLOR_COUNT = 8;

/** 0 = пусто, 1..COLOR_COUNT = id цвета блока, <0 = бомба (-таймер),
 *  STONE_* = камень-препятствие (2 удара: целый → в трещинах → разрушен) */
export type Grid = number[][];

/** Камни: 98 = целый гладкий (2 HP), 97 = весь в трещинах (1 HP) */
export const STONE_CRACKED = 97;
export const STONE_INTACT = 98;

/** Это клетка-камень? */
export function isStone(v: number): boolean {
  return v >= STONE_CRACKED && v <= STONE_INTACT;
}

/** Стадия камня для отрисовки: 0 = гладкий, 1 = в трещинах */
export function stoneStage(v: number): number {
  return STONE_INTACT - v;
}

/** Удар по камню (очистка ряда с камнем): возвращает true, если камень разрушен */
export function hitStone(grid: Grid, r: number, c: number): boolean {
  const v = grid[r][c];
  if (!isStone(v)) return false;
  if (v > STONE_CRACKED) {
    grid[r][c] = v - 1;
    return false;
  }
  grid[r][c] = 0;
  return true;
}

export interface Shape {
  cells: [number, number][]; // [row, col] от левого верхнего угла
  w: number;
  h: number;
  size: number;
}

export interface Piece {
  shape: Shape;
  color: number;
  /** индекс клетки-бомбы в shape.cells (null — обычная фигура) */
  bomb: number | null;
  /** тиков до взрыва; тикает и в лотке, и на поле */
  bombTimer: number | null;
}

function shape(rows: string[]): Shape {
  const cells: [number, number][] = [];
  rows.forEach((r, ri) => {
    for (let ci = 0; ci < r.length; ci++) {
      if (r[ci] === "#") cells.push([ri, ci]);
    }
  });
  return {
    cells,
    w: Math.max(...rows.map((r) => r.length)),
    h: rows.length,
    size: cells.length,
  };
}

/** Все формы в стиле Block Blast */
export const SHAPES: Shape[] = [
  // 1 клетка
  shape(["#"]),
  // 2
  shape(["##"]),
  shape(["#", "#"]),
  // 3 в линию
  shape(["###"]),
  shape(["#", "#", "#"]),
  // 3 уголком (L-тромино, 4 поворота)
  shape(["#.", "##"]),
  shape(["##", "#."]),
  shape(["##", ".#"]),
  shape([".#", "##"]),
  // квадрат 2x2
  shape(["##", "##"]),
  // 4 в линию
  shape(["####"]),
  shape(["#", "#", "#", "#"]),
  // T (4 поворота)
  shape(["###", ".#."]),
  shape(["#.", "##", "#."]),
  shape([".#", "##", ".#"]),
  shape([".#", "###"]),
  // S / Z
  shape([".##", "##"]),
  shape(["##.", ".##"]),
  shape(["#.", "##", ".#"]),
  shape([".#", "##", "#."]),
  // L / J (8 вариантов)
  shape(["#.", "#.", "##"]),
  shape(["###", "#.."]),
  shape(["##", ".#", ".#"]),
  shape(["..#", "###"]),
  shape([".#", ".#", "##"]),
  shape(["#..", "###"]),
  shape(["##", "#.", "#."]),
  shape(["###", "..#"]),
  // большой угол 5 клеток (4 поворота)
  shape(["#..", "#..", "###"]),
  shape(["###", "#..", "#.."]),
  shape(["###", "..#", "..#"]),
  shape(["..#", "..#", "###"]),
  // 5 в линию
  shape(["#####"]),
  shape(["#", "#", "#", "#", "#"]),
  // 2x3 / 3x2
  shape(["###", "###"]),
  shape(["##", "##", "##"]),
  // плюс
  shape([".#.", "###", ".#."]),
  // U
  shape(["#.#", "###"]),
  // 3x3
  shape(["###", "###", "###"]),
];

/** Палитра блоков (тёплые «конфетные» тона) */
export const BLOCK_COLORS: { top: string; bottom: string }[] = [
  { top: "#FF8A8A", bottom: "#E14D4D" }, // коралл
  { top: "#FFC766", bottom: "#E8960F" }, // янтарь
  { top: "#5EEAA0", bottom: "#16A34A" }, // изумруд
  { top: "#F9A8D4", bottom: "#DB2777" }, // роза
  { top: "#BFA7FB", bottom: "#7C3AED" }, // аметист
  { top: "#4FE3D1", bottom: "#0D9488" }, // бирюза
  { top: "#FDB074", bottom: "#EA580C" }, // апельсин
  { top: "#C3F06A", bottom: "#65A30D" }, // лайм
];

export function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array<number>(GRID_SIZE).fill(0));
}

export function canPlace(grid: Grid, s: Shape, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row + s.h > GRID_SIZE || col + s.w > GRID_SIZE) return false;
  for (const [dr, dc] of s.cells) {
    if (grid[row + dr][col + dc] !== 0) return false;
  }
  return true;
}

export function canPlaceAnywhere(grid: Grid, s: Shape): boolean {
  for (let r = 0; r <= GRID_SIZE - s.h; r++) {
    for (let c = 0; c <= GRID_SIZE - s.w; c++) {
      if (canPlace(grid, s, r, c)) return true;
    }
  }
  return false;
}

/** Полные строки и столбцы (камни и бомбы считаются заполненными) */
export function fullLines(grid: Grid): { rows: number[]; cols: number[] } {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every((v) => v !== 0)) rows.push(r);
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (grid[r][c] === 0) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export interface ScoreResult {
  total: number;
  lineMult: number;
  streakMult: number;
}

/** Очки за взорванные клетки: 12 за клетку, множитель за несколько линий и серию */
export function clearScore(lines: number, cellsCleared: number, streak: number): ScoreResult {
  const lineMult = lines === 1 ? 1 : lines === 2 ? 2 : lines === 3 ? 4 : 6;
  const streakMult = 1 + 0.1 * Math.min(streak, 10);
  return {
    total: Math.round(cellsCleared * 12 * lineMult * streakMult),
    lineMult,
    streakMult,
  };
}

// Вес формы по размеру (сколько клеток)
const SIZE_WEIGHTS: Record<number, number> = {
  1: 2.5,
  2: 2.5,
  3: 2.0,
  4: 1.6,
  5: 0.9,
  6: 0.8,
  9: 0.25,
};

/** Сложность 0..1 — с ростом счёта крупные фигуры появляются чаще */
export function difficultyOf(score: number): number {
  return Math.min(1, score / 2500);
}

/** Доля клеток цвета цели в лотке (подсветка «собери цвет») */
export const GOAL_COLOR_BIAS = 0.25;

/** Фабрика одной фигуры: вес по сложности + цвет цели с байасом */
function makePiece(difficulty: number, goalColor?: number, goalBias = GOAL_COLOR_BIAS): Piece {
  const t = Math.max(0, Math.min(1, difficulty));
  const smallBias = 1 - 0.5 * t;
  const bigBias = 0.35 + 1.9 * t;
  const weights = SHAPES.map((s) => {
    const base = SIZE_WEIGHTS[s.size] ?? 0.4;
    return base * (s.size <= 4 ? smallBias : bigBias);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let shape = SHAPES[0];
  for (let i = 0; i < SHAPES.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      shape = SHAPES[i];
      break;
    }
  }
  const bias = goalColor !== undefined && goalColor >= 1 && goalColor <= 8;
  const color =
    bias && Math.random() < goalBias ? goalColor : 1 + Math.floor(Math.random() * COLOR_COUNT);
  return { shape, color, bomb: null, bombTimer: null };
}

/** Тройка новых фигур; гарантирует, что хотя бы одна влезает на поле.
 *  goalColor — цвет цели «собери»: такие блоки выпадают чаще. */
export function generatePieces(
  grid: Grid,
  difficulty: number,
  allowBomb = false,
  goalColor?: number,
  goalBias = GOAL_COLOR_BIAS,
): Piece[] {
  const t = Math.max(0, Math.min(1, difficulty));
  const fresh = (): Piece => makePiece(t, goalColor, goalBias);

  for (let attempt = 0; attempt < 12; attempt++) {
    const pieces: Piece[] = [fresh(), fresh(), fresh()];
    // одна фигура из тройки может нести бомбу (не больше одной на сет);
    // шанс ниже, потому что основные бомбы появляются сами на поле
    if (allowBomb && Math.random() < Math.min(0.45, 0.2 + 0.28 * t)) {
      const p = pieces[Math.floor(Math.random() * 3)];
      p.bomb = Math.floor(Math.random() * p.shape.cells.length);
      p.bombTimer = bombTimerFor(t);
    }
    if (pieces.some((p) => canPlaceAnywhere(grid, p.shape))) return pieces;
  }
  // страховка: 1x1 влезает всегда, пока есть хоть одна пустая клетка
  return [fresh(), fresh(), fresh()].map((p, i) => (i === 0 ? { ...p, shape: SHAPES[0] } : p));
}

/** Одна новая фигура (бесконечный режим: поставленная сразу заменяется новой).
 *  bombChance — вероятность того, что фигура несёт бомбу. */
export function generatePiece(difficulty: number, goalColor?: number, bombChance = 0): Piece {
  const t = Math.max(0, Math.min(1, difficulty));
  const fresh = makePiece(t, goalColor);
  if (bombChance > 0 && Math.random() < bombChance) {
    fresh.bomb = Math.floor(Math.random() * fresh.shape.cells.length);
    fresh.bombTimer = bombTimerFor(t);
  }
  return fresh;
}

/** Фитиль бомбы: тиков до взрыва (сложнее — короче) */
export function bombTimerFor(difficulty: number): number {
  return Math.max(4, 8 - Math.floor(difficulty * 3));
}

/** Тик всех бомб на поле. Свежепоставленные (skip) не тикают в этот же ход.
 *  Возвращает координаты бомб, у которых фитиль догорел. */
export function tickBoardBombs(grid: Grid, skip: Set<number>): [number, number][] {
  const exploded: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r][c];
      if (v < 0 && !skip.has(r * 100 + c)) {
        if (v + 1 >= 0) {
          grid[r][c] = 0;
          exploded.push([r, c]);
        } else {
          grid[r][c] = v + 1;
        }
      }
    }
  }
  return exploded;
}

/** Взрыв на поле: выжигает 3x3 (в т.ч. камни и другие бомбы — без потери жизни).
 *  Возвращает [r, c, старое значение] для частиц. */
export function explodeCrater(grid: Grid, r: number, c: number): [number, number, number][] {
  const cleared: [number, number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < GRID_SIZE && cc >= 0 && cc < GRID_SIZE && grid[rr][cc] !== 0) {
        cleared.push([rr, cc, grid[rr][cc]]);
        grid[rr][cc] = 0;
      }
    }
  }
  return cleared;
}

/** Сколько бомб попадает во взрываемые линии (обезвреживается) */
export function bombsInLines(grid: Grid, rows: number[], cols: number[]): number {
  let n = 0;
  const seen = new Set<number>();
  for (const r of rows) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const k = r * 100 + c;
      if (!seen.has(k)) {
        seen.add(k);
        if (grid[r][c] < 0) n++;
      }
    }
  }
  for (const c of cols) {
    for (let r = 0; r < GRID_SIZE; r++) {
      const k = r * 100 + c;
      if (!seen.has(k)) {
        seen.add(k);
        if (grid[r][c] < 0) n++;
      }
    }
  }
  return n;
}

// ── Полевые бомбы: появляются сами, создают давление как гравитация в тетрисе ─

/** Максимум полевых бомб на поле одновременно */
export const MAX_BOARD_BOMBS = 4;

/** Спавн полевой бомбы на случайной пустой клетке. null — поле заполнено.
 *  БЕЗОПАСНЫЙ СПАВН: если передан лоток pieces, бомба не появится в клетке,
 *  после которой ни одна фигура лотка больше не влезает на поле. */
export function spawnBoardBomb(
  grid: Grid,
  timer: number,
  pieces: (Piece | null)[] = [],
): [number, number] | null {
  const empty: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  shuffle(empty);
  const tray = pieces.filter((p) => p !== null);
  const safe = (r: number, c: number): boolean => {
    if (tray.length === 0) return true;
    grid[r][c] = -timer;
    const ok = tray.some((p) => canPlaceAnywhere(grid, p.shape));
    grid[r][c] = 0;
    return ok;
  };
  for (const [r, c] of empty) {
    if (safe(r, c)) {
      grid[r][c] = -timer;
      return [r, c];
    }
  }
  return null;
}

/** Камни на случайных пустых клетках в начале уровня (препятствия) */
export function spawnStones(grid: Grid, count: number): [number, number][] {
  const placed: [number, number][] = [];
  let attempts = 0;
  while (placed.length < count && attempts < 500) {
    attempts += 1;
    const r = Math.floor(GRID_SIZE * Math.random());
    const c = Math.floor(GRID_SIZE * Math.random());
    if (grid[r][c] === 0) {
      grid[r][c] = STONE_INTACT;
      placed.push([r, c]);
    }
  }
  return placed;
}

/** Камни на случайных пустых клетках — безопасно: после каждого камня
 *  хотя бы одна фигура лотка должна влезать (для катящихся задач endless). */
export function spawnStonesSafe(
  grid: Grid,
  count: number,
  pieces: (Piece | null)[] = [],
): [number, number][] {
  const empty: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  shuffle(empty);
  const tray = pieces.filter((p) => p !== null);
  const placed: [number, number][] = [];
  for (const [r, c] of empty) {
    if (placed.length >= count) break;
    grid[r][c] = STONE_INTACT;
    if (tray.length === 0 || tray.some((p) => canPlaceAnywhere(grid, p.shape))) placed.push([r, c]);
    else grid[r][c] = 0;
  }
  return placed;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Сколько бомб сейчас на поле (клетки с отрицательным значением) */
export function boardBombCount(grid: Grid): number {
  let n = 0;
  for (const row of grid) {
    for (const v of row) if (v < 0) n++;
  }
  return n;
}

/** Фитиль полевой бомбы — щедрее фигурной: под неё надо построить линию */
export function boardBombTimerFor(difficulty: number): number {
  const t = Math.max(0, Math.min(1, difficulty));
  return Math.max(7, 12 - Math.floor(t * 4));
}

/** Молоток: убрать один блок (в т.ч. бомбу или камень). Возвращает старое значение (0 = пусто) */
export function applyHammer(grid: Grid, r: number, c: number): number {
  if (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE) return 0;
  const v = grid[r][c];
  grid[r][c] = 0;
  return v;
}

/** Ходов между появлениями полевых бомб (давление растёт со сложностью) */
export function bombSpawnInterval(difficulty: number): number {
  const t = Math.max(0, Math.min(1, difficulty));
  return Math.max(3, 5 - Math.floor(t * 2));
}
