"use client";

// ── Реклама: демо-оверлей для веба + мост к нативному Yandex Mobile Ads SDK ──

import { useCallback, useEffect, useRef, useState } from "react";
import { Bomb, Video, X } from "lucide-react";
import { tr, type Lang } from "./i18n";

export interface YandexAdsPlugin {
  addListener(eventName: string, cb: (data: { type?: string }) => void): Promise<{ remove(): Promise<void> }>;
  loadRewarded(opts: { blockId: string }): Promise<void>;
  showRewarded(): Promise<void>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  Plugins?: { YandexAds?: YandexAdsPlugin };
}

declare global {
  interface Window {
    Capacitor?: CapacitorLike;
  }
}

/** Нативный Yandex Ads доступен? (в вебе — false, играем демо-ролик) */
export function isNativeYandexAds(): boolean {
  const cap = window.Capacitor;
  return (
    !!cap &&
    typeof cap.isNativePlatform === "function" &&
    cap.isNativePlatform() &&
    !!cap.Plugins?.YandexAds &&
    typeof cap.Plugins.YandexAds.addListener === "function"
  );
}

export type RewardedResult = "rewarded" | "closed" | "failed" | "unavailable";

/** Показать Rewarded-ролик через Capacitor-мост YandexAds.
 *  Резолвится "rewarded" только если игрок досмотрел до награды. */
export async function showRewardedAd(blockId = "demo-rewarded-yandex"): Promise<RewardedResult> {
  const cap = window.Capacitor;
  const yandex = cap?.Plugins?.YandexAds;
  if (!cap || !yandex || !cap.isNativePlatform?.()) return "unavailable";

  const events: string[] = [];
  const waiters: { types: string[]; resolve: (v: string) => void; timer: number }[] = [];
  const waitFor = (types: string[], timeout: number): Promise<string> =>
    new Promise((resolve) => {
      const hit = types.find((t) => events.includes(t));
      if (hit) {
        resolve(hit);
        return;
      }
      const waiter = {
        types,
        resolve,
        timer: 0,
      };
      waiter.timer = window.setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        resolve("__timeout__");
      }, timeout);
      waiters.push(waiter);
    });

  let listener: { remove(): Promise<void> } | null = null;
  try {
    listener = await yandex.addListener("rewardedAdEvent", (data) => {
      const type = String(data?.type ?? "");
      events.push(type);
      for (const w of [...waiters]) {
        if (w.types.includes(type)) {
          window.clearTimeout(w.timer);
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(type);
        }
      }
    });
    await yandex.loadRewarded({ blockId });
    const loaded = await waitFor(["loaded", "failedToLoad"], 25_000);
    if (loaded !== "loaded") return "failed";
    await yandex.showRewarded();
    const dismissed = await waitFor(["dismissed", "failedToShow"], 240_000);
    if (dismissed !== "dismissed") return "failed";
    return events.includes("rewarded") ? "rewarded" : "closed";
  } catch {
    return "failed";
  } finally {
    try {
      await listener?.remove();
    } catch {
      // слушатель уже снят
    }
  }
}

/** Длительность демо-ролика, мс */
const DEMO_MS = 5000;

/** Хук рекламного потока: нативная реклама или демо-ролик + состояния UI.
 *  onReward вызывается только за досмотренный ролик; busy=true, пока ролик занимает экран. */
export function useRewardedAd(
  reward: number,
  onReward: (n: number) => void,
): {
  open: boolean;
  loading: boolean;
  failed: boolean;
  start: () => void;
  close: () => void;
  claim: () => void;
} {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const failTimer = useRef(0);
  const busyRef = useRef(false);
  const onRewardRef = useRef(onReward);
  useEffect(() => {
    onRewardRef.current = onReward;
  }, [onReward]);

  const close = useCallback(() => {
    busyRef.current = false;
    setOpen(false);
    setLoading(false);
  }, []);

  const claim = useCallback(() => {
    onRewardRef.current(reward);
    close();
  }, [reward, close]);

  const start = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFailed(false);
    setOpen(true);
    if (isNativeYandexAds()) {
      setLoading(true);
      void showRewardedAd().then((res) => {
        if (res === "rewarded") {
          claim();
        } else {
          close();
          if (res === "failed") {
            setFailed(true);
            window.clearTimeout(failTimer.current);
            failTimer.current = window.setTimeout(() => setFailed(false), 3500);
          }
        }
      });
    }
  }, [claim, close]);

  useEffect(() => () => window.clearTimeout(failTimer.current), []);

  return { open, loading, failed, start, close, claim };
}

interface AdOverlayProps {
  lang: Lang;
  reward: number;
  onClaim: () => void;
  onAbort: () => void;
}

/** Демо-оверлей «рекламы» для веба: 5 секунд — и кнопка награды */
export default function AdOverlay({ lang, reward, onClaim, onAbort }: AdOverlayProps) {
  const t = tr(lang);
  const [msLeft, setMsLeft] = useState(DEMO_MS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, DEMO_MS - (performance.now() - start));
      setMsLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        setReady(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.ceil(msLeft / 1000);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={t.adTitle}
    >
      <button
        type="button"
        onClick={onAbort}
        aria-label={t.adCloseAria}
        className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/60 transition active:scale-90 hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
      <div className="w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#14121b] p-5 text-center shadow-2xl">
        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/35">{t.adTitle}</div>
        <div className="mt-3 grid h-36 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 animate-pulse">
          <div className="flex flex-col items-center gap-1.5 text-white">
            <Video className="size-10" aria-hidden="true" />
            <div className="text-lg font-black tracking-wide">{t.appName}</div>
            <Bomb className="size-5 text-white/80" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-3 text-xs leading-relaxed text-white/40">{t.adNote}</div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {ready ? (
            <button
              type="button"
              onClick={onClaim}
              className="w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-sm font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95"
            >
              {t.adClaim(reward)}
            </button>
          ) : (
            <div
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-black text-white/50 tabular-nums"
              role="status"
              aria-live="polite"
            >
              {t.adSeconds(seconds)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
