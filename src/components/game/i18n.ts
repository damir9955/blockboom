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
  // главное меню
  menuAria: string;
  menuContinue: string;
  menuContinueAll: string;
  menuLevelSub: (n: number) => string;
  menuLevelSelect: string;
  menuHelp: string;
  menuSettings: string;
  menuContinueAria: (n: number) => string;
  menuLevelSelectAria: string;
  menuHelpAria: string;
  menuSettingsAria: string;
  backToMenuAria: string;
  menuFooterLevels: (n: number, total: number) => string;
  menuFooterStars: (n: number, total: number) => string;
  // ежедневный подарок
  giftTitle: string;
  giftClaim: (n: number) => string;
  giftClaimed: string;
  giftAria: (n: number) => string;
  giftSectionAria: string;
  // панель монет
  coinsTitle: string;
  coinsTotal: string;
  coinsHow: string;
  coinsOpenAria: string;
  // инструменты
  toolPanelAria: (name: string) => string;
  toolEmpty: string;
  // подсказки-туториал
  tipAria: string;
  tipGotIt: string;
  tipPlay: string;
  tipStartTitle: string;
  tipStartA: string;
  tipStartB: string;
  tipStartC: string;
  tipBombTitle: string;
  tipBombA: string;
  tipBombB: string;
  tipBombC: string;
  tipStoneTitle: string;
  tipStoneA: string;
  tipStoneB: string;
  tipStoneC: string;
  // справка
  helpTitle: string;
  helpBasicsTitle: string;
  helpBasicsText: string;
  helpModesTitle: string;
  helpModesText: string;
  helpGoalsTitle: string;
  helpGoalsText: string;
  helpLinesTitle: string;
  helpLinesText: string;
  helpBombsTitle: string;
  helpBombsText: string;
  helpStonesTitle: string;
  helpStonesText: string;
  helpCollectTitle: string;
  helpCollectText: string;
  helpToolsTitle: string;
  helpToolsText: string;
  helpCoinsTitle: string;
  helpCoinsText: string;
  // настройки
  settingsTitle: string;
  settingsSound: string;
  settingsLang: string;
  settingsLangAria: string;
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
  goalStones: string;
  hintLines: (target: number, moves: number) => string;
  hintScore: (target: number, moves: number) => string;
  hintDefuse: (target: number) => string;
  hintCollect: (target: number, colorName: string) => string;
  hintStones: (target: number) => string;
  colorNames: string[];
  // бесконечный режим
  menuClassic: string;
  menuEndless: string;
  menuEndlessAria: string;
  menuEndlessSub: (best: number) => string;
  endlessChip: string;
  endlessBoardAria: string;
  endlessOver: string;
  endlessNewRecord: string;
  endlessBest: string;
  endlessAgain: string;
  endlessToMenu: string;
  endlessNoCoins: string;
  endlessSetsDone: (n: number) => string;
  endlessSetDone: string;
  endlessTasksLabel: string;
  difficultyAria: (d: number) => string;
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
  exitAria: "Выйти к выбору уровня",
  boardAria: "Игровое поле: перетаскивай фигуры из нижнего лотка на сетку",
  levelComplete: (n) => `Уровень ${n} пройден!`,
  coinsReward: (n) => `+${n} монет`,
  winStats: (score, movesLeft, defused) =>
    `Очки: ${score} · Ходов осталось: ${Math.max(0, movesLeft)} · Обезврежено: ${defused}`,
  nextLevel: "Следующий уровень",
  toMap: "Выбрать уровень",
  retryImprove: "Повторить",
  menuAria: "Главное меню",
  menuContinue: "Продолжить",
  menuContinueAll: "Все уровни пройдены!",
  menuLevelSub: (n) => `Уровень ${n}`,
  menuLevelSelect: "Выбрать уровень",
  menuHelp: "Помощь",
  menuSettings: "Настройки",
  menuContinueAria: (n) => `Продолжить с уровня ${n}`,
  menuLevelSelectAria: "Открыть карту уровней",
  menuHelpAria: "Открыть помощь и правила игры",
  menuSettingsAria: "Открыть настройки: звук и язык",
  backToMenuAria: "Вернуться в главное меню",
  menuFooterLevels: (n, total) => `Уровни ${n}/${total}`,
  menuFooterStars: (n, total) => `Звёзды ${n}/${total}`,
  giftTitle: "Ежедневный подарок",
  giftClaim: (n) => `Забрать +${n}`,
  giftClaimed: "Получен — приходи завтра",
  giftAria: (n) => `Забрать ежедневный подарок: ${n} монет`,
  giftSectionAria: "Подарок за вход, монеты и инструменты",
  coinsTitle: "Монеты",
  coinsTotal: "Твой баланс",
  coinsHow: "Не хватает? Посмотри рекламу — и баланс пополнится",
  coinsOpenAria: "Монеты: пополнить за рекламу",
  toolPanelAria: (name) => `Инструмент: ${name}`,
  toolEmpty: "Закончился!",
  tipAria: "Краткое объяснение",
  tipGotIt: "Понятно",
  tipPlay: "Играть!",
  tipStartTitle: "Как играть",
  tipStartA: "Перетаскивай фигуры из лотка на поле",
  tipStartB: "Заполни ряд или столбец целиком — он взорвётся",
  tipStartC: "Выполни задачи сверху, пока есть ходы",
  tipBombTitle: "Бомба!",
  tipBombA: "Накрой бомбу линией — она обезвредится",
  tipBombB: "Фитиль тикает каждый ход и по времени",
  tipBombC: "Не успеешь — бабах: минус жизнь",
  tipStoneTitle: "Камень",
  tipStoneA: "Первая линия покрывает камень трещинами",
  tipStoneB: "Вторая линия разбивает его вдребезги",
  tipStoneC: "Взрыв бомбы или молоток сносят камень сразу",
  helpTitle: "Помощь",
  helpBasicsTitle: "Как играть",
  helpBasicsText:
    "Перетаскивай фигуры из лотка на поле 8×8. Фигуры не вращаются — ставь как дают. Когда поставлена третья фигура, лоток наполняется заново.",
  helpModesTitle: "Режимы игры",
  helpModesText:
    "Классика — 50 уровней с задачами, лимитом ходов и наградами. Бесконечный режим — игра без остановки: задачи появляются, выполняются и сразу сменяются новыми, поле и счёт не сбрасываются; сложность ходит волнами от 1 (легко) до 5 (сложно) и снова с 1, как в маджонгах; изредка попадаются наборы сразу из 4 задач. Поставленная фигура сразу заменяется новой. Проиграть можно от бомб или когда фигуры больше не помещаются. Монеты в этом режиме не начисляются.",
  helpGoalsTitle: "Задачи уровня",
  helpGoalsText:
    "Сверху показаны задачи: линии, очки, сбор цвета, обезвреженные бомбы или разбитые камни. Уровень пройден, когда закрыты все задачи. Ходы ограничены — следи за счётчиком слева.",
  helpLinesTitle: "Линии и серии",
  helpLinesText:
    "Заполни ряд или столбец целиком — он взорвётся. Две линии сразу — двойная, три — тройная, четыре — мега удар! Взрывы подряд без промаха дают серию и множитель очков.",
  helpBombsTitle: "Бомбы",
  helpBombsText:
    "Бомба появляется с фитилём — числом ходов до взрыва. Фитиль тикает каждым ходом и каждые несколько секунд простоя. Накрой бомбу линией — она обезвредитcя (+100). Взрыв отнимает жизнь и выжигает кратер 3×3. Жизней всего три.",
  helpStonesTitle: "Камни",
  helpStonesText:
    "Серые камни занимают клетки, но не считаются заполненными. Первая линия, проходящая через камень, покрывает его трещинами. Вторая — разбивает вдребезги. Взрыв бомбы и молоток сносят камень сразу.",
  helpCollectTitle: "Сбор цвета",
  helpCollectText:
    "В задачах может быть цвет: собери N блоков этого цвета из взорванных линий. Нужные блоки подсвечены рамкой на поле и выпадают чаще обычных.",
  helpToolsTitle: "Инструменты",
  helpToolsText:
    "Молоток сносит любой блок (бомбу — обезвреживает). Микс заменяет все фигуры в лотке. +5 ходов добавляет ходы, когда их не хватает. Кончились — купи за монеты или пополни рекламой.",
  helpCoinsTitle: "Монеты и звёзды",
  helpCoinsText:
    "Монеты дают за уровни и звёзды, ежедневный вход и рекламу. Звёзды — за запас ходов без потерь жизней. Монеты трать на инструменты; за три звезды награда максимальная.",
  settingsTitle: "Настройки",
  settingsSound: "Звук",
  settingsLang: "Язык",
  settingsLangAria: "Выбор языка",
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
  goalStones: "Камни",
  hintLines: (target, moves) =>
    Number.isFinite(moves) ? `Взорви ${target} линий за ${moves} ходов` : `Взорви ${target} линий`,
  hintScore: (target, moves) =>
    Number.isFinite(moves) ? `Набери ${target} очков за ${moves} ходов` : `Набери ${target} очков`,
  hintDefuse: (target) => `Обезвредь ${target} бомб: закрывай их линиями`,
  hintCollect: (target, colorName) =>
    `Убери ${target} блоков «${colorName}» из взрываемых линий — они подсвечены рамкой и выпадают чаще`,
  hintStones: (target) => `Разбей ${target} камней: первая линия дает трещины, вторая — разрушает`,
  menuClassic: "Классика",
  menuEndless: "Бесконечный режим",
  menuEndlessAria: "Играть в бесконечный режим: задачи сменяют друг друга без остановки",
  menuEndlessSub: (best) => (best > 0 ? `Рекорд: ${best}` : "Задачи без остановки"),
  endlessChip: "Бесконечный режим",
  endlessBoardAria: "Бесконечный режим: перетаскивай фигуры из лотка на сетку",
  endlessOver: "Игра окончена",
  endlessNewRecord: "Новый рекорд!",
  endlessBest: "Рекорд",
  endlessAgain: "Ещё раз",
  endlessToMenu: "В меню",
  endlessNoCoins: "Монеты в этом режиме не начисляются",
  endlessSetsDone: (n) => `Задач выполнено: ${n}`,
  endlessSetDone: "ЗАДАЧИ ВЫПОЛНЕНЫ!",
  endlessTasksLabel: "Задачи",
  difficultyAria: (d) => `Сложность ${d} из 5`,
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
  exitAria: "Back to level select",
  boardAria: "Game board: drag pieces from the tray onto the grid",
  levelComplete: (n) => `Level ${n} complete!`,
  coinsReward: (n) => `+${n} coins`,
  winStats: (score, movesLeft, defused) =>
    `Score: ${score} · Moves left: ${Math.max(0, movesLeft)} · Defused: ${defused}`,
  nextLevel: "Next level",
  toMap: "Select level",
  retryImprove: "Retry",
  menuAria: "Main menu",
  menuContinue: "Continue",
  menuContinueAll: "All levels complete!",
  menuLevelSub: (n) => `Level ${n}`,
  menuLevelSelect: "Select level",
  menuHelp: "Help",
  menuSettings: "Settings",
  menuContinueAria: (n) => `Continue from level ${n}`,
  menuLevelSelectAria: "Open the level map",
  menuHelpAria: "Open help and game rules",
  menuSettingsAria: "Open settings: sound and language",
  backToMenuAria: "Back to the main menu",
  menuFooterLevels: (n, total) => `Levels ${n}/${total}`,
  menuFooterStars: (n, total) => `Stars ${n}/${total}`,
  giftTitle: "Daily gift",
  giftClaim: (n) => `Claim +${n}`,
  giftClaimed: "Claimed — come back tomorrow",
  giftAria: (n) => `Claim the daily gift: ${n} coins`,
  giftSectionAria: "Daily gift, coins and tools",
  coinsTitle: "Coins",
  coinsTotal: "Your balance",
  coinsHow: "Running low? Watch an ad to top up",
  coinsOpenAria: "Coins: top up with an ad",
  toolPanelAria: (name) => `Tool: ${name}`,
  toolEmpty: "Out of stock!",
  tipAria: "Quick explanation",
  tipGotIt: "Got it",
  tipPlay: "Play!",
  tipStartTitle: "How to play",
  tipStartA: "Drag pieces from the tray onto the board",
  tipStartB: "Fill a full row or column — it blasts",
  tipStartC: "Complete the goals above before moves run out",
  tipBombTitle: "Bomb!",
  tipBombA: "Cover a bomb with a line — it gets defused",
  tipBombB: "The fuse ticks every move and over time",
  tipBombC: "Too slow — boom: you lose a life",
  tipStoneTitle: "Stone",
  tipStoneA: "The first line cracks the stone all over",
  tipStoneB: "The second line shatters it",
  tipStoneC: "Bomb blasts and the hammer smash it at once",
  helpTitle: "Help",
  helpBasicsTitle: "How to play",
  helpBasicsText:
    "Drag pieces from the tray onto the 8×8 board. Pieces don't rotate — place them as they come. Once the third piece is placed, the tray refills.",
  helpModesTitle: "Game modes",
  helpModesText:
    "Classic — 50 levels with goals, a move limit and rewards. Endless mode — non-stop play: goals appear, get completed and are instantly replaced with new ones, while the board and score carry over; the difficulty rides waves from 1 (easy) to 5 (hard) and back to 1, like in mahjong solitaire; rare sets carry 4 goals at once. A placed piece is replaced with a new one right away. You lose to bombs or when pieces no longer fit. No coins are earned in endless mode.",
  helpGoalsTitle: "Level goals",
  helpGoalsText:
    "The goals sit at the top: lines, score, color collecting, defused bombs or smashed stones. The level is complete when every goal is closed. Moves are limited — watch the counter on the left.",
  helpLinesTitle: "Lines and streaks",
  helpLinesText:
    "Fill a full row or column — it blasts. Two lines at once is a double, three a triple, four a mega blast! Back-to-back blasts build a streak with a score multiplier.",
  helpBombsTitle: "Bombs",
  helpBombsText:
    "A bomb appears with a fuse — the number of moves before it blows. The fuse ticks on every move and every couple of idle seconds. Cover the bomb with a line — it defuses (+100). An explosion costs a life and burns a 3×3 crater. You only have three lives.",
  helpStonesTitle: "Stones",
  helpStonesText:
    "Grey stones occupy cells but don't count as filled. The first line passing through a stone covers it in cracks. The second shatters it. Bomb blasts and the hammer destroy a stone at once.",
  helpCollectTitle: "Color collecting",
  helpCollectText:
    "A goal may name a color: collect N blocks of that color from blasted lines. Those blocks glow with a border on the board and drop more often.",
  helpToolsTitle: "Tools",
  helpToolsText:
    "The hammer smashes any block (and defuses bombs). Shuffle replaces all tray pieces. +5 moves adds moves when you run short. Out of tools — buy with coins or top up via an ad.",
  helpCoinsTitle: "Coins and stars",
  helpCoinsText:
    "Coins come from levels, stars, daily visits and ads. Stars reward spare moves with no lives lost. Spend coins on tools; three stars pay the most.",
  settingsTitle: "Settings",
  settingsSound: "Sound",
  settingsLang: "Language",
  settingsLangAria: "Language choice",
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
  goalStones: "Stones",
  hintLines: (target, moves) =>
    Number.isFinite(moves) ? `Blast ${target} lines in ${moves} moves` : `Blast ${target} lines`,
  hintScore: (target, moves) =>
    Number.isFinite(moves) ? `Score ${target} points in ${moves} moves` : `Score ${target} points`,
  hintDefuse: (target) => `Defuse ${target} bombs: clear them with full lines`,
  hintCollect: (target, colorName) =>
    `Clear ${target} "${colorName}" blocks from blasted lines — they glow with a border and drop more often`,
  hintStones: (target) => `Smash ${target} stones: the first line cracks them, the second shatters them`,
  menuClassic: "Classic",
  menuEndless: "Endless mode",
  menuEndlessAria: "Play the endless mode: goals replace each other non-stop",
  menuEndlessSub: (best) => (best > 0 ? `Best: ${best}` : "Non-stop goals"),
  endlessChip: "Endless mode",
  endlessBoardAria: "Endless mode: drag pieces from the tray onto the grid",
  endlessOver: "Game over",
  endlessNewRecord: "New record!",
  endlessBest: "Best",
  endlessAgain: "Play again",
  endlessToMenu: "To menu",
  endlessNoCoins: "No coins are earned in this mode",
  endlessSetsDone: (n) => `Sets completed: ${n}`,
  endlessSetDone: "GOALS COMPLETE!",
  endlessTasksLabel: "Sets",
  difficultyAria: (d) => `Difficulty ${d} of 5`,
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
