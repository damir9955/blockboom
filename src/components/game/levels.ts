// ── Уровни Блок Бум: цели, лимит ходов, звёзды, награды ─────────────────────
// 50 уровней; с ростом номера: 1 → 2 → 3 задачи, камни-препятствия, больше бомб,
// меньше ходов впрок и чуть меньше очков (scoreMultiplier 1.0 → 0.75).

import { tr, type Lang } from "./i18n";

export type GoalType = "lines" | "score" | "defuse" | "collect";

export interface Goal {
  type: GoalType;
  target: number;
  /** цвет для collect-целей */
  color?: number;
}

export interface LevelDef {
  n: number;
  /** 1..3 задачи уровня — победа, когда выполнены ВСЕ */
  goals: Goal[];
  moves: number;
  diff: number;
  /** ход, с которого на поле сами появляются бомбы (Infinity = никогда) */
  bombsFrom: number;
  /** ходов между появлениями полевых бомб */
  bombEvery: number;
  /** фигуры в лотке могут нести бомбы */
  pieceBombs: boolean;
  /** стартовые камни-препятствия (смыть линией нельзя — только взрыв/молоток) */
  stones: number;
}

export const LEVEL_COUNT = 50;
export const MAX_STARS = 3;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Одиночная цель уровня n (до масштабирования на количество задач) */
function singleTarget(n: number, type: GoalType): number {
  switch (type) {
    case "lines":
      return clamp(2 + Math.floor(n * 0.2), 2, 10);
    case "score":
      // очки с ростом уровня набираются медленнее (scoreMultiplier) — цель мягче
      return clamp(320 + n * 33, 320, 1600);
    case "collect":
      return clamp(11 + Math.floor(n * 0.2), 11, 16);
    case "defuse":
      return clamp(1 + Math.floor(n / 9), 1, 5);
  }
}

function minTarget(type: GoalType): number {
  switch (type) {
    case "lines":
      return 2;
    case "score":
      return 220;
    case "collect":
      return 7;
    case "defuse":
      return 1;
  }
}

function scaledTarget(n: number, type: GoalType, goalsCount: number): number {
  const scale = goalsCount <= 1 ? 1 : goalsCount === 2 ? 0.62 : 0.52;
  // «обезвредь» в мульти-задачах мягче: бомбы и так давят
  if (type === "defuse" && goalsCount > 1) {
    return Math.max(1, Math.round(singleTarget(n, type) * scale) - 1);
  }
  return Math.max(minTarget(type), Math.round(singleTarget(n, type) * scale));
}

const GOAL_ROTATION: GoalType[] = ["lines", "score", "collect", "defuse"];

/** Сколько задач на уровне: 1-14 — одна; 15-29 — две; 30+ — две/три (каждый 5-й — три) */
function goalsCountFor(n: number): number {
  if (n < 15) return 1;
  if (n < 30) return 2;
  return n % 5 === 0 ? 3 : 2;
}

function buildLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const wave = Math.floor((n - 1) / 5); // волна сложности 0..9
    const cycle = (n - 1) % 5;
    // базовая задача по ротации; cycle 4 — «линии» чуть крупнее
    const baseType: GoalType =
      cycle === 1 ? "score" : cycle === 2 ? "collect" : cycle === 3 ? "defuse" : "lines";
    const k = goalsCountFor(n);

    // типы задач: базовая + следующие по ротации (без повторов, collect максимум один)
    const types: GoalType[] = [baseType];
    if (k > 1) {
      const pool = GOAL_ROTATION.filter((t) => t !== baseType);
      for (let i = 0; i < k - 1; i++) types.push(pool[(n + i) % pool.length]);
    }

    const goals: Goal[] = types.map((type) => {
      const target = scaledTarget(n, type, k);
      if (type === "collect") return { type, target, color: 1 + ((n * 3) % 8) };
      return { type, target };
    });

    const hasScore = goals.some((g) => g.type === "score");
    const moves = clamp(Math.round(18 + wave * 1.5 + (hasScore ? 2 : 0) + (k - 1) * 3), 16, 35);
    const diff = clamp(0.05 + n * 0.016, 0, 0.78);
    // бомбы: со временем появляются раньше и чаще; на очковых уровнях — чуть реже
    const bombsFrom = n <= 2 ? Infinity : Math.max(3, 12 - wave);
    const bombEvery = n <= 2 ? Infinity : Math.max(5, 9 - wave) + (hasScore ? 1 : 0);
    // камни: с 13-го уровня, мягкая нарастающая шкала 2..5
    const stones = n < 13 || !Number.isFinite(bombsFrom) ? 0 : Math.min(5, 2 + Math.floor((n - 13) / 7));
    out.push({ n, goals, moves, diff, bombsFrom, bombEvery, pieceBombs: n >= 9, stones });
  }
  // Ручная калибровка первых уровней (туториальная плавность, но не «подарок»)
  out[0] = { ...out[0], goals: [{ type: "lines", target: 2 }], moves: 14 }; // уровень 1
  out[1] = { ...out[1], goals: [{ type: "lines", target: 3 }], moves: 16 }; // уровень 2
  out[2] = { ...out[2], goals: [{ type: "score", target: 600 }], moves: 21 }; // уровень 3
  out[4] = {
    ...out[4],
    goals: [{ type: "collect", target: 12, color: 2 }],
    moves: 20,
  }; // уровень 5
  out[5] = { ...out[5], goals: [{ type: "defuse", target: 2 }], moves: 20 }; // уровень 6
  out[6] = { ...out[6], goals: [{ type: "lines", target: 5 }], moves: 22 }; // уровень 7
  out[17] = { ...out[17], moves: 24 }; // уровень 18: чуть жестче (collect+lines иначе слишком мягко)
  // на уровнях с задачей «обезвредь» бомбы обязаны появляться щедро (после оверрайдов!);
  // на поздних — чуть реже, иначе 3 жизни не выживают
  for (const l of out) {
    if (l.goals.some((g) => g.type === "defuse")) {
      l.bombsFrom = Math.min(l.bombsFrom, 2);
      l.bombEvery = Math.min(l.bombEvery, l.n >= 30 ? 5 : 4);
    }
  }
  return out;
}

export const LEVELS: LevelDef[] = buildLevels();

/** Затухание очков: чем выше уровень, тем чуть меньше набирается (сильно не режем) */
export function scoreMultiplier(level: LevelDef): number {
  return 1 - Math.min(0.25, (level.n - 1) * 0.005);
}

/** Первая collect-задача уровня (подмешивание цвета + подсветка блоков) */
export function collectGoal(level: LevelDef): Goal | undefined {
  return level.goals.find((g) => g.type === "collect");
}

export interface GoalStats {
  lines: number;
  defused: number;
  collected: number;
  score: number;
}

function goalDone(g: Goal, s: GoalStats): boolean {
  switch (g.type) {
    case "lines":
      return s.lines >= g.target;
    case "score":
      return s.score >= g.target;
    case "defuse":
      return s.defused >= g.target;
    case "collect":
      return s.collected >= g.target;
  }
}

/** Уровень пройден, когда выполнены ВСЕ задачи */
export function goalReached(level: LevelDef, s: GoalStats): boolean {
  return level.goals.every((g) => goalDone(g, s));
}

export interface GoalProgress {
  label: string;
  now: number;
  target: number;
  done: boolean;
  goal: Goal;
}

/** Прогресс каждой задачи для HUD-чипов */
export function goalProgressTexts(level: LevelDef, s: GoalStats, lang: Lang = "ru"): GoalProgress[] {
  const t = tr(lang);
  return level.goals.map((g) => {
    const now =
      g.type === "lines"
        ? Math.min(s.lines, g.target)
        : g.type === "score"
          ? Math.min(s.score, g.target)
          : g.type === "defuse"
            ? Math.min(s.defused, g.target)
            : Math.min(s.collected, g.target);
    const label =
      g.type === "lines" ? t.goalLines : g.type === "score" ? t.goalScore : g.type === "defuse" ? t.goalDefuse : t.goalCollect;
    return { label, now, target: g.target, done: goalDone(g, s), goal: g };
  });
}

function goalHintOne(g: Goal, lang: Lang, moves: number): string {
  const t = tr(lang);
  switch (g.type) {
    case "lines":
      return t.hintLines(g.target, moves);
    case "score":
      return t.hintScore(g.target, moves);
    case "defuse":
      return t.hintDefuse(g.target);
    case "collect":
      return t.hintCollect(g.target, t.colorNames[(g.color ?? 1) - 1] ?? "");
  }
}

/** Подсказка уровня (для aria у карты): все задачи через «; » */
export function goalHint(level: LevelDef, lang: Lang = "ru"): string {
  return level.goals.map((g) => goalHintOne(g, lang, level.moves)).join("; ");
}

/** Звёзды: 3 — много ходов в запасе и без потерь жизней, 1 — просто прошёл */
export function starsFor(movesLeftRatio: number, livesLost: number): number {
  if (movesLeftRatio >= 0.4 && livesLost === 0) return 3;
  if (movesLeftRatio >= 0.2 || livesLost === 0) return 2;
  return 1;
}

export const COIN_REPLAY = 20;

export function coinsFor(stars: number, firstClear: boolean): number {
  return firstClear ? 50 + 40 * stars : COIN_REPLAY;
}
