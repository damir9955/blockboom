// ── Прогресс игрока: уровни, звёзды, монеты, бустеры, подарок, рекорд ────────

import { LEVEL_COUNT } from "./levels";

export type BoosterKind = "hammer" | "shuffle" | "plus5";

export type TipKind = "start" | "bomb" | "stone";

export interface Progress {
  /** сколько уровней открыто (1..LEVEL_COUNT) */
  unlocked: number;
  /** уровень → лучшее число звёзд (ключи — строки для JSON) */
  stars: Record<string, number>;
  coins: number;
  boosters: { hammer: number; shuffle: number; plus5: number };
  muted: boolean;
  /** какие обучающие подсказки уже показаны */
  tips: Record<TipKind, boolean>;
  /** день последнего полученного подарка (номер дня, см. dayNumber) */
  giftDay: number;
  /** рекорд очков в бесконечном режиме */
  bestEndless: number;
}

const KEY = "blockboom-progress-v1";

export const START_PROGRESS: Progress = {
  unlocked: 1,
  stars: {},
  coins: 200,
  boosters: { hammer: 2, shuffle: 1, plus5: 1 },
  muted: false,
  tips: { start: false, bomb: false, stone: false },
  giftDay: 0,
  bestEndless: 0,
};

export const PRICES: Record<BoosterKind, number> = {
  hammer: 100,
  shuffle: 150,
  plus5: 120,
};

/** Номер текущего дня (без таймзонных сюрпризов) — для ежедневного подарка */
export function dayNumber(d: Date = new Date()): number {
  return Math.floor((d.getTime() - 60_000 * d.getTimezoneOffset()) / 86_400_000);
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...START_PROGRESS };
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      unlocked: clampInt(p.unlocked, 1, LEVEL_COUNT, 1),
      stars: sanitizeStars(p.stars),
      coins: clampInt(p.coins, 0, 1_000_000, START_PROGRESS.coins),
      boosters: {
        hammer: clampInt(p.boosters?.hammer, 0, 99, START_PROGRESS.boosters.hammer),
        shuffle: clampInt(p.boosters?.shuffle, 0, 99, START_PROGRESS.boosters.shuffle),
        plus5: clampInt(p.boosters?.plus5, 0, 99, START_PROGRESS.boosters.plus5),
      },
      muted: p.muted === true,
      tips: {
        start: p.tips?.start === true,
        bomb: p.tips?.bomb === true,
        stone: p.tips?.stone === true,
      },
      giftDay: clampInt(p.giftDay, 0, 2_000_000, 0),
      bestEndless: clampInt(p.bestEndless, 0, 10_000_000, 0),
    };
  } catch {
    return { ...START_PROGRESS };
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // приватный режим — играем без сохранений
  }
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : dflt;
  return Math.max(lo, Math.min(hi, n));
}

function sanitizeStars(v: unknown): Record<string, number> {
  if (typeof v !== "object" || v === null) return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = clampInt(k, 1, LEVEL_COUNT, 0);
    if (n >= 1 && (val === 1 || val === 2 || val === 3)) out[String(n)] = val;
  }
  return out;
}

export function totalStars(p: Progress): number {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}

export function firstClearOf(p: Progress, n: number): boolean {
  return p.stars[String(n)] === undefined;
}

/** Начислить награду за пройденный уровень и открыть следующий.
 *  Уровень открывается только последовательно: победа на текущем последнем. */
export function awardLevel(p: Progress, n: number, stars: number, coins: number): Progress {
  const key = String(n);
  const prev = p.stars[key] ?? 0;
  const maxStars = n >= 1 && n <= LEVEL_COUNT ? Math.max(prev, Math.min(3, Math.max(1, stars))) : prev;
  const nextUnlocked = n === p.unlocked ? Math.min(LEVEL_COUNT, n + 1) : p.unlocked;
  return {
    ...p,
    stars: { ...p.stars, [key]: maxStars },
    unlocked: nextUnlocked,
    coins: p.coins + Math.max(0, coins),
  };
}

/** Ежедневный подарок: +50 монет, один раз в день; null — уже получен */
export const GIFT_REWARD = 50;

export function claimDailyGift(p: Progress): Progress | null {
  const today = dayNumber();
  if (p.giftDay >= today) return null;
  return { ...p, giftDay: today, coins: p.coins + GIFT_REWARD };
}

/** Купить бустер; null — не хватило монет */
export function buyBooster(p: Progress, kind: BoosterKind): Progress | null {
  const price = PRICES[kind];
  if (p.coins < price) return null;
  return {
    ...p,
    coins: p.coins - price,
    boosters: { ...p.boosters, [kind]: p.boosters[kind] + 1 },
  };
}

/** Списать бустер (использование в уровне); null — их нет */
export function spendBooster(p: Progress, kind: BoosterKind): Progress | null {
  if (p.boosters[kind] <= 0) return null;
  return {
    ...p,
    boosters: { ...p.boosters, [kind]: p.boosters[kind] - 1 },
  };
}
