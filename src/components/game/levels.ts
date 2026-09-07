// ── Уровни БЛОК БУМ: несколько целей, лимит ходов, камни, звёзды, награды ────
// + бесконечный режим: «катящиеся» наборы задач без остановки

import { tr, type Lang } from "./i18n";

export type GoalType = "lines" | "score" | "defuse" | "collect" | "stones";

export interface GoalDef {
  type: GoalType;
  target: number;
  color?: number;
}

export interface LevelDef {
  n: number;
  /** 1-3 одновременных цели уровня */
  goals: GoalDef[];
  moves: number;
  diff: number;
  /** ход, с которого на поле сами появляются бомбы (Infinity = никогда) */
  bombsFrom: number;
  /** ходов между появлениями полевых бомб */
  bombEvery: number;
  /** фигуры в лотке могут нести бомбы */
  pieceBombs: boolean;
  /** камней на поле в начале уровня (0 = нет) */
  stones: number;
}

export const LEVEL_COUNT = 50;
export const MAX_STARS = 3;
export const TOTAL_STARS = LEVEL_COUNT * MAX_STARS;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Базовая (одиночная) цель уровня — растёт с номером */
function baseTarget(n: number, type: GoalType): number {
  switch (type) {
    case "lines":
      return clamp(2 + Math.floor(0.2 * n), 2, 10);
    case "score":
      return clamp(320 + 33 * n, 320, 1600);
    case "collect":
      return clamp(11 + Math.floor(0.2 * n), 11, 16);
    case "defuse":
      return clamp(1 + Math.floor(n / 9), 1, 5);
    case "stones":
      return clamp(2 + Math.floor(n / 20), 2, 5);
  }
}

/** Минимум, ниже которого цель теряет смысл */
function minTarget(type: GoalType): number {
  switch (type) {
    case "lines":
    case "stones":
      return 2;
    case "score":
      return 220;
    case "collect":
      return 7;
    case "defuse":
      return 1;
  }
}

/** Цель с поправкой на число одновременных задач (сложнее — ниже порог) */
function goalTargetFor(n: number, type: GoalType, goalCount: number): number {
  const f = goalCount <= 1 ? 1 : goalCount === 2 ? 0.62 : 0.52;
  if (type === "defuse" && goalCount > 1) return Math.max(1, Math.round(baseTarget(n, type) * f) - 1);
  return Math.max(minTarget(type), Math.round(baseTarget(n, type) * f));
}

const GOAL_TYPES: GoalType[] = ["lines", "score", "collect", "defuse"];

function buildLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const wave = Math.floor((n - 1) / 5);
    const cycle = (n - 1) % 5;
    const primary: GoalType =
      cycle === 1
        ? "score"
        : cycle === 2
          ? "collect"
          : cycle === 3
            ? "defuse"
            : cycle === 4 && n >= 15
              ? "stones"
              : "lines";
    const goalCount = n < 15 ? 1 : n < 30 ? 2 : n % 5 === 0 ? 3 : 2;
    const types: GoalType[] = [primary];
    if (goalCount > 1) {
      const others = GOAL_TYPES.filter((g) => g !== primary);
      for (let k = 0; k < goalCount - 1; k++) types.push(others[(n + k) % others.length]);
    }
    const goals: GoalDef[] = types.map((type) => {
      const target = goalTargetFor(n, type, goalCount);
      return type === "collect" ? { type, target, color: 1 + ((3 * n) % 8) } : { type, target };
    });
    const hasScore = goals.some((g) => g.type === "score");
    const moves = clamp(Math.round(18 + 1.5 * wave + 2 * (hasScore ? 1 : 0) + (goalCount - 1) * 3), 16, 35);
    const diff = clamp(0.05 + 0.016 * n, 0, 0.78);
    const bombsFrom = n <= 2 ? Infinity : Math.max(3, 12 - wave);
    const bombEvery = n <= 2 ? Infinity : Math.max(5, 9 - wave) + (hasScore ? 1 : 0);
    // камни появляются с 13-го уровня и постепенно размножаются;
    // на уровнях с целью «камни» их на одну больше, чем требуется разбить
    const base = n < 13 || !Number.isFinite(bombsFrom) ? 0 : Math.min(5, 2 + Math.floor((n - 13) / 7));
    const stones = primary === "stones" ? Math.min(6, base + 1) : base;
    if (primary === "stones") goals[0] = { type: "stones", target: Math.max(2, stones - 1) };
    out.push({ n, goals, moves, diff, bombsFrom, bombEvery, pieceBombs: n >= 9, stones });
  }
  // Ручная калибровка первых уровней (туториальная плавность)
  out[0] = { ...out[0], goals: [{ type: "lines", target: 2 }], moves: 14 };
  out[1] = { ...out[1], goals: [{ type: "lines", target: 3 }], moves: 16 };
  out[2] = { ...out[2], goals: [{ type: "score", target: 600 }], moves: 21 };
  out[4] = { ...out[4], goals: [{ type: "collect", target: 12, color: 2 }], moves: 20 };
  out[5] = { ...out[5], goals: [{ type: "defuse", target: 2 }], moves: 20 };
  out[6] = { ...out[6], goals: [{ type: "lines", target: 5 }], moves: 22 };
  out[17] = { ...out[17], moves: 24 };
  // на уровнях с целью «обезвредь» бомбы обязаны появляться щедро (после оверрайдов!)
  for (const l of out) {
    if (l.goals.some((g) => g.type === "defuse")) {
      l.bombsFrom = Math.min(l.bombsFrom, 2);
      l.bombEvery = Math.min(l.bombEvery, l.n >= 30 ? 5 : 4);
    }
  }
  return out;
}

export const LEVELS: LevelDef[] = buildLevels();

// ── Бесконечный режим: наборы задач сменяют друг друга без остановки ─────────

export interface EndlessSetDef {
  /** номер набора (растёт с каждым выполненным) */
  n: number;
  /** 1-4 задачи набора */
  goals: GoalDef[];
  /** волна сложности 1..5 — как в маджонгах: 1→5 и снова с 1 */
  difficulty: number;
  /** фигуры в лотке могут нести бомбы (с волны 3) */
  pieceBombs: boolean;
  /** ходов между появлениями полевых бомб (Infinity = волна без бомб) */
  bombEvery: number;
  /** сложность генерации фигур (крупные чаще) */
  shapeDiff: number;
}

/** Набор задач для бесконечного режима № n. Сложность ходит волнами 1..5 по кругу;
 *  изредка (№ % 10 == 5) набор состоит сразу из 4 задач. */
export function generateEndlessSet(n: number): EndlessSetDef {
  const difficulty = ((n - 1) % 5) + 1;
  const cycle = Math.floor((n - 1) / 5);
  const primary: GoalType =
    difficulty === 2
      ? "score"
      : difficulty === 3
        ? "collect"
        : difficulty === 4
          ? "defuse"
          : difficulty === 5
            ? "stones"
            : "lines";
  const goalCount =
    difficulty === 1
      ? 1
      : difficulty === 2
        ? n % 2 === 0
          ? 2
          : 1
        : difficulty === 3
          ? 2
          : difficulty === 4
            ? n % 3 === 0
              ? 3
              : 2
            : n > 5 && n % 10 === 5
              ? 4
              : 3;
  // «номер уровня», эквивалентный по сложности (растёт с каждым кругом волн)
  const levelEquiv = 5 * difficulty - 2 + Math.min(8, 2 * cycle);
  const types: GoalType[] = [primary];
  if (goalCount > 1) {
    const others = GOAL_TYPES.filter((g) => g !== primary);
    for (let k = 0; k < goalCount - 1; k++) types.push(others[(n + k) % others.length]);
  }
  const goals: GoalDef[] = types.map((type) => {
    const target = goalTargetFor(levelEquiv, type, goalCount);
    return type === "collect" ? { type, target, color: 1 + ((3 * n) % 8) } : { type, target };
  });
  if (primary === "stones") goals[0] = { type: "stones", target: 3 };
  else if (primary === "defuse") goals[0] = { type: "defuse", target: goalCount >= 3 ? 2 : 3 };
  const set: EndlessSetDef = {
    n,
    goals,
    difficulty,
    pieceBombs: difficulty >= 3,
    bombEvery: difficulty <= 1 ? Infinity : Math.max(4, 9 - difficulty),
    shapeDiff: Math.min(0.6, 0.08 + 0.09 * (difficulty - 1) + 0.008 * Math.min(cycle, 12)),
  };
  // на наборах с задачей «обезвредь» бомбы обязаны появляться
  if (set.goals.some((g) => g.type === "defuse")) set.bombEvery = Math.min(set.bombEvery, 4);
  return set;
}

/** Снимок набора в форме «уровня» — для общих проверок целей и HUD */
export function endlessSnapshot(set: EndlessSetDef): LevelDef {
  return {
    n: set.n,
    goals: set.goals,
    moves: Infinity,
    diff: 0,
    bombsFrom: Infinity,
    bombEvery: Infinity,
    pieceBombs: false,
    stones: 0,
  };
}

export interface GoalStats {
  lines: number;
  defused: number;
  collected: number;
  score: number;
  /** разбито камней (для цели «камни») */
  stones: number;
}

export function goalReached(goal: GoalDef, s: GoalStats): boolean {
  switch (goal.type) {
    case "lines":
      return s.lines >= goal.target;
    case "score":
      return s.score >= goal.target;
    case "defuse":
      return s.defused >= goal.target;
    case "collect":
      return s.collected >= goal.target;
    case "stones":
      return s.stones >= goal.target;
  }
}

/** Уровень пройден, когда закрыты ВСЕ его цели */
export function allGoalsReached(level: LevelDef, s: GoalStats): boolean {
  return level.goals.every((g) => goalReached(g, s));
}

export function collectGoalOf(level: LevelDef): GoalDef | undefined {
  return level.goals.find((g) => g.type === "collect");
}

/** Прогресс каждой цели для HUD-чипов */
export function goalProgressList(
  level: LevelDef,
  s: GoalStats,
  lang: Lang = "ru",
): { label: string; now: number; target: number; done: boolean; goal: GoalDef }[] {
  const t = tr(lang);
  return level.goals.map((goal) => {
    const now =
      goal.type === "lines"
        ? Math.min(s.lines, goal.target)
        : goal.type === "score"
          ? Math.min(s.score, goal.target)
          : goal.type === "defuse"
            ? Math.min(s.defused, goal.target)
            : goal.type === "stones"
              ? Math.min(s.stones, goal.target)
              : Math.min(s.collected, goal.target);
    const label =
      goal.type === "lines"
        ? t.goalLines
        : goal.type === "score"
          ? t.goalScore
          : goal.type === "defuse"
            ? t.goalDefuse
            : goal.type === "stones"
              ? t.goalStones
              : t.goalCollect;
    return { label, now, target: goal.target, done: goalReached(goal, s), goal };
  });
}

function goalHintText(goal: GoalDef, t: ReturnType<typeof tr>, moves: number): string {
  switch (goal.type) {
    case "lines":
      return t.hintLines(goal.target, moves);
    case "score":
      return t.hintScore(goal.target, moves);
    case "defuse":
      return t.hintDefuse(goal.target);
    case "collect":
      return t.hintCollect(goal.target, t.colorNames[(goal.color ?? 1) - 1] ?? "");
    case "stones":
      return t.hintStones(goal.target);
  }
}

/** Подсказка уровня (для карты/ARIA): все цели через «; » */
export function levelHint(level: LevelDef, lang: Lang = "ru"): string {
  const t = tr(lang);
  return level.goals.map((g) => goalHintText(g, t, level.moves)).join("; ");
}

/** Множитель очков: на старте 1.0, к 50-му уровню опускается до 0.75 */
export function scoreMultiplier(level: LevelDef): number {
  return 1 - Math.min(0.25, (level.n - 1) * 0.005);
}

/** Звёзды: 3 — много ходов в запасе и без потерь жизней, 1 — просто прошёл */
export function starsFor(movesLeftRatio: number, livesLost: number): number {
  if (movesLeftRatio >= 0.4 && livesLost === 0) return 3;
  if (movesLeftRatio >= 0.2 || livesLost === 0) return 2;
  return 1;
}

export const COIN_REPLAY = 10;

export function coinsFor(stars: number, firstClear: boolean): number {
  return firstClear ? 30 + 20 * stars : COIN_REPLAY;
}
