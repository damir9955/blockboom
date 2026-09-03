// ── Локализация Блок Бум: русский + английский ─────────────────────────────

export type Lang = "ru" | "en";

const LANG_KEY = "blockboom-lang";

export function isLang(v: unknown): v is Lang {
  return v === "ru" || v === "en";
}

/** Язык: сохранённый выбор → язык браузера (ru* → ru, остальное → en) */
export function detectLang(): Lang {
  if (typeof window === "undefined") return "ru";
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // приватный режим — берём язык браузера
  }
  const nav = typeof navigator !== "undefined" ? (navigator.language || "").toLowerCase() : "ru";
  return nav.startsWith("ru") ? "ru" : "en";
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // приватный режим — играем без сохранения
  }
}

export interface Strings {
  appName: string;
  // карта
  levelsWord: string;
  allWord: string;
  coinsAria: (n: number) => string;
  levelMapAria: string;
  levelNChip: (n: number) => string;
  levelLockedAria: (n: number) => string;
  levelDoneAria: (n: number, st: number) => string;
  boosterShopAria: string;
  buyAria: (label: string, price: number, count: number) => string;
  soundOnAria: string;
  soundOffAria: string;
  switchLangAria: (to: Lang) => string;
  // бустеры
  hammer: string;
  shuffle: string;
  plus5: string;
  // игра: HUD
  moves: string;
  score: string;
  streakChip: (mult: string) => string;
  goalAria: (label: string, now: number, target: number) => string;
  goalsAria: string;
  livesAria: (n: number) => string;
  exitAria: string;
  boardAria: string;
  // оверлей победы
  levelComplete: (n: number) => string;
  coinsReward: (n: number) => string;
  winStats: (score: number, movesLeft: number, defused: number) => string;
  nextLevel: string;
  toMap: string;
  retryImprove: string;
  // оверлей поражения
  levelFailed: (n: number) => string;
  loseMoves: string;
  loseBombs: string;
  loseStall: string;
  goalLine: (label: string, now: number, target: number) => string;
  retry: string;
  // бустеры: aria
  hammerAria: (n: number) => string;
  shuffleAria: (n: number) => string;
  plus5Aria: (n: number) => string;
  // магазин в игре
  shop: string;
  shopAria: string;
  shopCoinsAria: (n: number) => string;
  buy: string;
  have: (n: number) => string;
  needed: (n: number) => string;
  close: string;
  // пополнение за рекламу
  topUp: (n: number) => string;
  topUpNote: string;
  topUpAria: (n: number) => string;
  // подтверждение покупки
  confirmBuyText: (name: string, price: number) => string;
  cancel: string;
  // реклама
  adTitle: string;
  adNote: string;
  adSeconds: (s: number) => string;
  adClaim: (n: number) => string;
  adCloseAria: string;
  adLoading: string;
  adUnavailable: string;
  // цели (levels.ts)
  goalLines: string;
  goalScore: string;
  goalDefuse: string;
  goalCollect: string;
  hintLines: (target: number, moves: number) => string;
  hintScore: (target: number, moves: number) => string;
  hintDefuse: (target: number) => string;
  hintCollect: (target: number, colorName: string) => string;
  colorNames: string[];
  // canvas-тексты
  mega: string;
  triple: string;
  double: string;
  streakText: (x: string) => string;
  defusedText: (n: number, pts: number) => string;
  bombSpawnText: string;
  defuse100: string;
  plus5Text: string;
  minusLife: string;
}

const ru: Strings = {
  appName: "БЛОК БУМ",
  levelsWord: "уровни",
  allWord: "все",
  coinsAria: (n) => `Монеты: ${n}`,
  levelMapAria: "Карта уровней",
  levelNChip: (n) => `Уровень ${n}`,
  levelLockedAria: (n) => `Уровень ${n} закрыт`,
  levelDoneAria: (n, st) => `Уровень ${n}, пройден на ${st} из 3`,
  boosterShopAria: "Магазин бустеров",
  buyAria: (label, price, count) => `Купить ${label} за ${price} монет. Есть: ${count}`,
  soundOnAria: "Включить звук",
  soundOffAria: "Выключить звук",
  switchLangAria: (to) => `Переключить язык на ${to === "en" ? "английский" : "русский"}`,
  hammer: "Молоток",
  shuffle: "Микс",
  plus5: "5 ходов",
  moves: "Ходы",
  score: "Очки",
  streakChip: (mult) => `Серия ×${mult}`,
  goalAria: (label, now, target) => `Цель уровня: ${label} ${now} из ${target}`,
  goalsAria: "Задачи уровня",
  livesAria: (n) => `Жизни: ${n} из 3`,
  exitAria: "Выйти на карту уровней",
  boardAria: "Игровое поле: перетаскивай фигуры из нижнего лотка на сетку",
  levelComplete: (n) => `Уровень ${n} пройден!`,
  coinsReward: (n) => `+${n} монет`,
  winStats: (score, movesLeft, defused) =>
    `Очки: ${score} · Ходов осталось: ${Math.max(0, movesLeft)} · Обезврежено: ${defused}`,
  nextLevel: "Следующий уровень",
  toMap: "На карту",
  retryImprove: "Повторить",
  levelFailed: (n) => `Уровень ${n} не пройден`,
  loseMoves: "Ходы закончились!",
  loseBombs: "Бабах! Бомбы одолели",
  loseStall: "Фигуры больше не помещаются",
  goalLine: (label, now, target) => `Цель: ${label} ${now}/${target}`,
  retry: "Повторить",
  hammerAria: (n) => `Молоток: разбить один блок, осталось ${n}`,
  shuffleAria: (n) => `Перемешать фигуры в лотке, осталось ${n}`,
  plus5Aria: (n) => `Пять дополнительных ходов, осталось ${n}`,
  shop: "Магазин",
  shopAria: "Магазин: купить бустеры за монеты, не покидая уровень",
  shopCoinsAria: (n) => `Монеты: ${n}`,
  buy: "Купить",
  have: (n) => `Есть: ${n}`,
  needed: (n) => `Не хватает ${n}`,
  close: "Закрыть",
  topUp: (n) => `Пополнить +${n}`,
  topUpNote: "за просмотр рекламы",
  topUpAria: (n) => `Посмотреть рекламу и пополнить баланс на ${n} монет`,
  confirmBuyText: (name, price) => `Купить «${name}» за ${price} монет?`,
  cancel: "Отмена",
  adTitle: "РЕКЛАМА",
  adNote: "Демо-ролик: настоящая реклама появится после подключения рекламной сети",
  adSeconds: (s) => `${s} с`,
  adClaim: (n) => `Забрать +${n} монет`,
  adCloseAria: "Закрыть рекламу без награды",
  adLoading: "Загрузка рекламы…",
  adUnavailable: "Реклама недоступна — попробуйте позже",
  goalLines: "Линии",
  goalScore: "Очки",
  goalDefuse: "Обезвредь",
  goalCollect: "Собери",
  hintLines: (target, moves) => `Взорви ${target} линий за ${moves} ходов`,
  hintScore: (target, moves) => `Набери ${target} очков за ${moves} ходов`,
  hintDefuse: (target) => `Обезвредь ${target} бомб: закрывай их линиями`,
  hintCollect: (target, colorName) =>
    `Убери ${target} блоков «${colorName}» из взрываемых линий — они подсвечены рамкой и выпадают чаще`,
  colorNames: ["Коралл", "Янтарь", "Изумруд", "Роза", "Аметист", "Бирюза", "Апельсин", "Лайм"],
  mega: "МЕГА УДАР!",
  triple: "ТРОЙНАЯ!",
  double: "ДВОЙНАЯ!",
  streakText: (x) => `СЕРИЯ ×${x}`,
  defusedText: (n, pts) => `ОБЕЗВРЕЖЕНО: ${n}! +${pts}`,
  bombSpawnText: "БОМБА!",
  defuse100: "ОБЕЗВРЕЖЕНО +100",
  plus5Text: "+5 ХОДОВ!",
  minusLife: "-1 ЖИЗНЬ",
};

const en: Strings = {
  appName: "BLOCK BOOM",
  levelsWord: "levels",
  allWord: "all",
  coinsAria: (n) => `Coins: ${n}`,
  levelMapAria: "Level map",
  levelNChip: (n) => `Level ${n}`,
  levelLockedAria: (n) => `Level ${n} is locked`,
  levelDoneAria: (n, st) => `Level ${n}, completed with ${st} of 3`,
  boosterShopAria: "Booster shop",
  buyAria: (label, price, count) => `Buy ${label} for ${price} coins. Have: ${count}`,
  soundOnAria: "Turn sound on",
  soundOffAria: "Turn sound off",
  switchLangAria: (to) => `Switch language to ${to === "en" ? "English" : "Russian"}`,
  hammer: "Hammer",
  shuffle: "Shuffle",
  plus5: "5 moves",
  moves: "Moves",
  score: "Score",
  streakChip: (mult) => `Streak ×${mult}`,
  goalAria: (label, now, target) => `Level goal: ${label} ${now} of ${target}`,
  goalsAria: "Level goals",
  livesAria: (n) => `Lives: ${n} of 3`,
  exitAria: "Back to the level map",
  boardAria: "Game board: drag pieces from the tray onto the grid",
  levelComplete: (n) => `Level ${n} complete!`,
  coinsReward: (n) => `+${n} coins`,
  winStats: (score, movesLeft, defused) =>
    `Score: ${score} · Moves left: ${Math.max(0, movesLeft)} · Defused: ${defused}`,
  nextLevel: "Next level",
  toMap: "Map",
  retryImprove: "Retry",
  levelFailed: (n) => `Level ${n} failed`,
  loseMoves: "Out of moves!",
  loseBombs: "Boom! The bombs won",
  loseStall: "No room left for the pieces",
  goalLine: (label, now, target) => `Goal: ${label} ${now}/${target}`,
  retry: "Retry",
  hammerAria: (n) => `Hammer: smash one block, ${n} left`,
  shuffleAria: (n) => `Shuffle the tray pieces, ${n} left`,
  plus5Aria: (n) => `Five extra moves, ${n} left`,
  shop: "Shop",
  shopAria: "Shop: buy boosters with coins without leaving the level",
  shopCoinsAria: (n) => `Coins: ${n}`,
  buy: "Buy",
  have: (n) => `Have: ${n}`,
  needed: (n) => `Need ${n} more`,
  close: "Close",
  topUp: (n) => `Top up +${n}`,
  topUpNote: "for watching an ad",
  topUpAria: (n) => `Watch an ad to top up your balance with ${n} coins`,
  confirmBuyText: (name, price) => `Buy "${name}" for ${price} coins?`,
  cancel: "Cancel",
  adTitle: "ADVERTISEMENT",
  adNote: "Demo roll: a real ad will appear once an ad network is connected",
  adSeconds: (s) => `${s}s`,
  adClaim: (n) => `Claim +${n} coins`,
  adCloseAria: "Close the ad without a reward",
  adLoading: "Loading ad…",
  adUnavailable: "Ad unavailable — try again later",
  goalLines: "Lines",
  goalScore: "Score",
  goalDefuse: "Defuse",
  goalCollect: "Collect",
  hintLines: (target, moves) => `Blast ${target} lines in ${moves} moves`,
  hintScore: (target, moves) => `Score ${target} points in ${moves} moves`,
  hintDefuse: (target) => `Defuse ${target} bombs: clear them with full lines`,
  hintCollect: (target, colorName) =>
    `Clear ${target} "${colorName}" blocks from blasted lines — they glow with a border and drop more often`,
  colorNames: ["Coral", "Amber", "Emerald", "Rose", "Amethyst", "Turquoise", "Orange", "Lime"],
  mega: "MEGA BLAST!",
  triple: "TRIPLE!",
  double: "DOUBLE!",
  streakText: (x) => `STREAK ×${x}`,
  defusedText: (n, pts) => `DEFUSED: ${n}! +${pts}`,
  bombSpawnText: "BOMB!",
  defuse100: "DEFUSED +100",
  plus5Text: "+5 MOVES!",
  minusLife: "-1 LIFE",
};

export const STRINGS: Record<Lang, Strings> = { ru, en };

export function tr(lang: Lang): Strings {
  return STRINGS[lang];
}
