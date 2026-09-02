// ── Мост к нативной рекламе (Yandex Mobile Ads SDK, Capacitor-плагин YandexAds) ──
//
// В Android-приложении (обёртка Capacitor) кнопка «Пополнить +110» показывает
// НАСТОЯЩУЮ рекламу за вознаграждение от Яндекса. В браузере/на сайте моста нет —
// вызывающий код показывает демо-оверлей AdOverlay, как раньше.
//
// ⚠️ ВАЖНО для владельца игры:
// REWARDED_BLOCK_ID ниже — демо-блок Яндекса. Он показывает тестовую рекламу
// БЕЗ регистрации. После регистрации приложения на https://ads.yandex.com
// замени его на настоящий ID блока «За вознаграждение» (R-M-XXXXXX-…) —
// иначе доход начисляться не будет!

export const REWARDED_BLOCK_ID = "demo-rewarded-yandex";

export type RewardedOutcome =
  /** ролик просмотрен до состояния награды — выдать монеты */
  | "rewarded"
  /** ролик закрыт без награды (или награда не выдана) */
  | "closed"
  /** ошибка загрузки/показа — сообщить игроку */
  | "failed"
  /** нативного моста нет (браузер/сайт) — показать демо-оверлей */
  | "unavailable";

/** События, которые шлёт нативный плагин через notifyListeners("rewardedAdEvent") */
interface NativePlugin {
  loadRewarded(o: { blockId: string }): Promise<void>;
  showRewarded(): Promise<void>;
  addListener(
    ev: string,
    cb: (data: { type?: string; description?: string }) => void,
  ): Promise<{ remove: () => void }>;
}

interface CapGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, NativePlugin | undefined>;
}

const cap = (): CapGlobal | undefined =>
  typeof window !== "undefined" ? (window as { Capacitor?: CapGlobal }).Capacitor : undefined;

/** Есть ли нативная реклама (true только внутри Android-приложения) */
export function nativeAdsAvailable(): boolean {
  const c = cap();
  return (
    !!c &&
    typeof c.isNativePlatform === "function" &&
    c.isNativePlatform() &&
    !!c.Plugins?.YandexAds &&
    typeof c.Plugins.YandexAds.addListener === "function"
  );
}

const AD_EVENT = "rewardedAdEvent";
const TIMEOUT_LOAD = 25_000; // загрузка ролика — до 25 с
const TIMEOUT_SHOW = 240_000; // сам ролик — до 4 минут

/**
 * Полный нативный цикл: загрузка → показ → исход.
 * Все обратные вызовы приходят событием rewardedAdEvent {type}.
 * Вызывать ТОЛЬКО при nativeAdsAvailable() === true.
 */
export async function showRewardedAd(blockId = REWARDED_BLOCK_ID): Promise<RewardedOutcome> {
  const c = cap();
  const plugin = c?.Plugins?.YandexAds;
  if (!c || !plugin || !c.isNativePlatform?.()) return "unavailable";

  // накопленные события показа + ожидающие вейт-коллбэки
  const seen: string[] = [];
  const waiters: {
    types: string[];
    resolve: (t: string) => void;
    timer: number;
  }[] = [];

  const waitEvent = (types: string[], timeoutMs: number): Promise<string> =>
    new Promise((resolve) => {
      const hit = types.find((t) => seen.includes(t));
      if (hit) {
        resolve(hit);
        return;
      }
      const w = { types, resolve, timer: 0 };
      w.timer = window.setTimeout(() => {
        const i = waiters.indexOf(w);
        if (i >= 0) waiters.splice(i, 1);
        resolve("__timeout__");
      }, timeoutMs);
      waiters.push(w);
    });

  let handle: { remove: () => void } | null = null;
  try {
    handle = await plugin.addListener(AD_EVENT, (e) => {
      const type = String(e?.type ?? "");
      seen.push(type);
      for (const w of [...waiters]) {
        if (w.types.includes(type)) {
          window.clearTimeout(w.timer);
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(type);
        }
      }
    });

    // 1) загрузка
    await plugin.loadRewarded({ blockId });
    const loaded = await waitEvent(["loaded", "failedToLoad"], TIMEOUT_LOAD);
    if (loaded !== "loaded") return "failed";

    // 2) показ (нативный экран перекрывает игру; исход придёт событием)
    await plugin.showRewarded();
    const done = await waitEvent(["dismissed", "failedToShow"], TIMEOUT_SHOW);

    // 3) итог: награда выдаётся ДО закрытия ролика
    if (done !== "dismissed") return "failed";
    return seen.includes("rewarded") ? "rewarded" : "closed";
  } catch {
    return "failed";
  } finally {
    try {
      await handle?.remove();
    } catch {
      // мост уже закрыт — не критично
    }
  }
}
