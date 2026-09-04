"use client";

// ── Панель монет и панель инструмента: пополнение за рекламу, покупка бустера ─

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import { Coins, Video, X } from "lucide-react";
import { tr, type Lang } from "./i18n";
import AdOverlay, { isNativeYandexAds, showRewardedAd } from "./AdOverlay";
import type { BoosterKind } from "./progress";

/** Хук показа рекламы: открывает демо-ролик (или нативный) и начисляет награду */
export function useAdReward(reward: number, onAdReward: (n: number) => void) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const failTimer = useRef(0);
  const rewardRef = useRef(reward);
  useEffect(() => {
    rewardRef.current = reward;
  }, [reward]);

  const close = useCallback(() => {
    setOpen(false);
    setLoading(false);
  }, []);

  const claim = useCallback(() => {
    onAdReward(rewardRef.current);
    close();
  }, [close, onAdReward]);

  const start = useCallback(() => {
    if (open) return;
    if (isNativeYandexAds()) {
      setOpen(true);
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
    } else {
      setOpen(true);
    }
  }, [claim, close, open]);

  return { open, loading, failed, start, close, claim };
}

interface CoinsPanelProps {
  lang: Lang;
  coins: number;
  reward: number;
  onAdReward: (n: number) => void;
  onClose: () => void;
}

/** Панель «Монеты»: баланс + пополнение за рекламу */
export default function CoinsPanel({ lang, coins, reward, onAdReward, onClose }: CoinsPanelProps) {
  const t = tr(lang);
  const ad = useAdReward(reward, onAdReward);

  if (ad.open) {
    if (ad.loading) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-white/10 bg-[#1c1a24] px-6 py-4 text-sm font-bold text-white/80 shadow-2xl">
            {t.adLoading}
          </div>
        </div>
      );
    }
    return <AdOverlay lang={lang} reward={reward} onClaim={ad.claim} onAbort={ad.close} />;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.coinsTitle}
    >
      <div className="tip-pop w-[86%] max-w-xs rounded-2xl border border-amber-400/25 bg-[#1c1a24] p-5 text-center shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-black uppercase tracking-widest text-white/70">{t.coinsTitle}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition active:scale-90 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-amber-300 to-orange-500 shadow-lg shadow-orange-950/50">
            <Coins className="size-7 text-[#221a08]" aria-hidden="true" />
          </span>
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-widest text-white/35">{t.coinsTotal}</div>
            <div key={coins} className="score-pop text-3xl font-black text-amber-300 tabular-nums">
              {coins}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs leading-relaxed text-white/45">{t.coinsHow}</div>
        {ad.failed && (
          <div className="mt-2 text-center text-[11px] font-bold text-rose-300/90" role="status">
            {t.adUnavailable}
          </div>
        )}
        <button
          type="button"
          onClick={ad.start}
          aria-label={t.topUpAria(reward)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-400/40 bg-gradient-to-b from-teal-500/25 to-teal-500/10 py-3 text-sm font-black text-teal-300 transition active:scale-95 hover:bg-teal-500/30"
        >
          <Video className="size-4" aria-hidden="true" />
          {t.topUp(reward)}
          <span className="text-[11px] font-bold text-teal-300/60">{t.topUpNote}</span>
        </button>
      </div>
    </div>
  );
}

interface ToolPanelProps {
  lang: Lang;
  label: string;
  Icon: ElementType;
  tone: string;
  price: number;
  count: number;
  coins: number;
  reward: number;
  onBuy: () => void;
  onAdReward: (n: number) => void;
  onClose: () => void;
}

/** Панель инструмента: купить бустер не покидая уровень */
export function ToolPanel({
  lang,
  label,
  Icon,
  tone,
  price,
  count,
  coins,
  reward,
  onBuy,
  onAdReward,
  onClose,
}: ToolPanelProps) {
  const t = tr(lang);
  const ad = useAdReward(reward, onAdReward);
  const affordable = coins >= price;

  if (ad.open) {
    if (ad.loading) {
      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-white/10 bg-[#1c1a24] px-6 py-4 text-sm font-bold text-white/80 shadow-2xl">
            {t.adLoading}
          </div>
        </div>
      );
    }
    return <AdOverlay lang={lang} reward={reward} onClaim={ad.claim} onAbort={ad.close} />;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.toolPanelAria(label)}
    >
      <div className="tip-pop w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="relative shrink-0">
              <span className={`grid size-12 place-items-center rounded-xl ${tone}`}>
                <Icon className="size-6 text-white" aria-hidden="true" />
              </span>
              <span
                className="absolute -right-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black"
                aria-label={t.have(count)}
              >
                {count}
              </span>
            </span>
            <div className="min-w-0">
              <div className="text-base font-black text-white">{label}</div>
              <div className="mt-0.5 flex items-center gap-1 text-sm font-black text-amber-300 tabular-nums">
                <Coins className="size-3.5" aria-hidden="true" />
                {price}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition active:scale-90 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        {count <= 0 && (
          <div className="mt-3 text-center text-xs font-bold text-rose-300/80" role="status">
            {t.toolEmpty}
          </div>
        )}
        {!affordable && (
          <div className="mt-2 text-center text-[11px] font-bold text-rose-300/80" role="status">
            {t.needed(price - coins)}
          </div>
        )}
        {ad.failed && (
          <div className="mt-2 text-center text-[11px] font-bold text-rose-300/90" role="status">
            {t.adUnavailable}
          </div>
        )}
        <button
          type="button"
          onClick={onBuy}
          disabled={!affordable}
          aria-label={t.buyAria(label, price, count)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-sm font-black text-[#221a08] shadow-lg shadow-orange-950/40 transition active:scale-95 disabled:opacity-40"
        >
          <Coins className="size-4" aria-hidden="true" />
          {t.buy}
          <span className="tabular-nums">· {price}</span>
        </button>
        <button
          type="button"
          onClick={ad.start}
          aria-label={t.topUpAria(reward)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-teal-400/40 bg-gradient-to-b from-teal-500/25 to-teal-500/10 py-3 text-sm font-black text-teal-300 transition active:scale-95 hover:bg-teal-500/30"
        >
          <Video className="size-4" aria-hidden="true" />
          {t.topUp(reward)}
          <span className="text-[11px] font-bold text-teal-300/60">{t.topUpNote}</span>
        </button>
      </div>
    </div>
  );
}
