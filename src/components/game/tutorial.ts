// ── Туториал новых механик: маленькое окно при ПЕРВОМ появлении механики ──────
// Показывается один раз (localStorage) и не занимает место в интерфейсе постоянно.

import { goalHint, type LevelDef } from "./levels";
import { tr, type Lang } from "./i18n";

export type TutId =
  | "goal-lines"
  | "goal-score"
  | "goal-collect"
  | "goal-defuse"
  | "bombs"
  | "piecebombs";

const KEY = "blockboom-tuts";

/** Прочитать уже показанные туториалы (пусто при отсутствии localStorage) */
export function seenTuts(): Set<TutId> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    const ids: TutId[] = ["goal-lines", "goal-score", "goal-collect", "goal-defuse", "bombs", "piecebombs"];
    return new Set(arr.filter((v): v is TutId => typeof v === "string" && (ids as string[]).includes(v)));
  } catch {
    return new Set();
  }
}

/** Отметить туториал показанным (больше не появится) */
export function markTutSeen(id: TutId): void {
  try {
    const s = seenTuts();
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // приватный режим — просто не сохраняем
  }
}

/** Очистить показанные туториалы (для тестов/e2e) */
export function resetTuts(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export interface TutInfo {
  id: TutId;
  /** заголовок окна */
  title: string;
  /** тело объяснения */
  body: string;
}

/** Туториал типа цели уровня — показывается на старте уровня с новым типом цели */
export function tutForGoal(level: LevelDef, lang: Lang): TutInfo | null {
  const t = tr(lang);
  const hint = goalHint(level, lang);
  switch (level.goal.type) {
    case "lines":
      return { id: "goal-lines", title: t.tutLinesTitle, body: hint };
    case "score":
      return { id: "goal-score", title: t.tutScoreTitle, body: hint };
    case "collect":
      return { id: "goal-collect", title: t.tutCollectTitle, body: hint };
    case "defuse":
      return { id: "goal-defuse", title: t.tutDefuseTitle, body: hint };
  }
}

/** Туториал про полевую бомбу — в момент, когда бомба ВПЕРВЫЕ появилась на поле */
export function tutForBombs(lang: Lang): TutInfo {
  const t = tr(lang);
  return { id: "bombs", title: t.tutBombsTitle, body: t.tutBombsBody };
}

/** Туториал про фигуры-бомбы — когда в лотке впервые фигура с бомбой */
export function tutForPieceBombs(lang: Lang): TutInfo {
  const t = tr(lang);
  return { id: "piecebombs", title: t.tutPieceBombsTitle, body: t.tutPieceBombsBody };
}
