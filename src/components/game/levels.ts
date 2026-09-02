// ── Уровни Блок Бум: цели, лимит ходов, звёзды, награды ─────────────────────

import { tr, type Lang } from "./i18n";

export type GoalType = "lines" | "score" | "defuse" | "collect";

export interface LevelDef {
  n: number;
  goal: { type: GoalType; target: number; color?: number };
  moves: number;
  diff: number;
  /** ход, с которого на поле сами появляются бомбы (Infinity = никогда) */
  bombsFrom: number;
  /** ходов между появлениями полевых бомб */
  bombEvery: number;
  /** фигуры в лотке могут нести бомбы */
  pieceBombs: boolean;
}

export const LEVEL_COUNT = 40;
export const MAX_STARS = 3;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function buildLevels(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const wave = Math.floor((n - 1) / 5); // волна сложности 0..7
    const cycle = (n - 1) % 5;
    let goal: LevelDef["goal"];
    let movesBonus = 0;
    switch (cycle) {
      case 0:
        goal = { type: "lines", target: clamp(2 + Math.floor(n * 0.36), 2, 16) };
        break;
      case 1:
        goal = { type: "score", target: clamp(350 + n * 70, 350, 3000) };
        movesBonus = 2;
        break;
      case 2:
        goal = { type: "collect", target: clamp(12 + Math.floor(n * 0.9), 12, 42), color: 1 + ((n * 3) % 8) };
        break;
      case 3:
        goal = { type: "defuse", target: clamp(1 + Math.floor((n - 1) / 6), 1, 6) };
        break;
      default:
        goal = { type: "lines", target: clamp(3 + Math.floor(n * 0.36), 3, 16) };
        break;
    }
    const moves = clamp(24 + wave * 2 + movesBonus, 24, 36);
    const diff = clamp(0.05 + n * 0.022, 0, 0.95);
    const bombsFrom = n <= 2 ? Infinity : Math.max(2, 9 - wave);
    const bombEvery = n <= 2 ? Infinity : Math.max(3, 7 - wave);
    out.push({
      n,
      goal,
      moves,
      diff,
      bombsFrom,
      bombEvery,
      pieceBombs: n >= 9,
    });
  }
  // Ручная калибровка первых уровней (туториальная плавность)
  out[1] = { ...out[1], goal: { type: "lines", target: 3 }, moves: 26 }; // уровень 2
  out[2] = { ...out[2], goal: { type: "score", target: 600 }, moves: 26 }; // уровень 3
  out[4] = { ...out[4], goal: { type: "collect", target: 14, color: 2 }, moves: 26 }; // уровень 5
  out[5] = { ...out[5], goal: { type: "defuse", target: 2 }, moves: 26 }; // уровень 6
  out[6] = { ...out[6], goal: { type: "lines", target: 5 }, moves: 28 }; // уровень 7
  // на уровнях «обезвредь бомбы» бомбы обязаны появляться щедро (после оверрайдов!)
  for (const l of out) {
    if (l.goal.type === "defuse") {
      l.bombsFrom = Math.min(l.bombsFrom, 2);
      l.bombEvery = Math.min(l.bombEvery, 4);
    }
  }
  return out;
}

export const LEVELS: LevelDef[] = buildLevels();

export interface GoalStats {
  lines: number;
  defused: number;
  collected: number;
  score: number;
}

export function goalReached(level: LevelDef, s: GoalStats): boolean {
  switch (level.goal.type) {
    case "lines":
      return s.lines >= level.goal.target;
    case "score":
      return s.score >= level.goal.target;
    case "defuse":
      return s.defused >= level.goal.target;
    case "collect":
      return s.collected >= level.goal.target;
  }
}

/** Текст прогресса цели для HUD: «Линии 2/5» / "Lines 2/5" */
export function goalProgressText(
  level: LevelDef,
  s: GoalStats,
  lang: Lang = "ru",
): { label: string; now: number; target: number } {
  const t = tr(lang);
  switch (level.goal.type) {
    case "lines":
      return { label: t.goalLines, now: Math.min(s.lines, level.goal.target), target: level.goal.target };
    case "score":
      return { label: t.goalScore, now: Math.min(s.score, level.goal.target), target: level.goal.target };
    case "defuse":
      return { label: t.goalDefuse, now: Math.min(s.defused, level.goal.target), target: level.goal.target };
    case "collect":
      return { label: t.goalCollect, now: Math.min(s.collected, level.goal.target), target: level.goal.target };
  }
}

export function goalHint(level: LevelDef, lang: Lang = "ru"): string {
  const t = tr(lang);
  switch (level.goal.type) {
    case "lines":
      return t.hintLines(level.goal.target, level.moves);
    case "score":
      return t.hintScore(level.goal.target, level.moves);
    case "defuse":
      return t.hintDefuse(level.goal.target);
    case "collect":
      return t.hintCollect(level.goal.target);
  }
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
