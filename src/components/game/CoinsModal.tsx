"use client";

// ── Модалка монет: баланс + пополнение за просмотр рекламы ─────────────────
// Единое место, где живёт кнопка «Пополнить +110 за рекламу».

import { Coins, Video, X } from "lucide-react";
import { tr, type Lang } from "./i18n";
import AdOverlay, { useRewardedAd } from "./AdOverlay";

interface CoinsModalProps {
  lang: Lang;
  coins: number;
  reward: number;
  onAdReward: (n: number) => void;
  onClose: () => void;
}

export default function CoinsModal({ lang, coins, reward, onAdReward, onClose }: CoinsModalProps) {
  const t = tr(lang);
  const ad = useRewardedAd(reward, onAdReward);

  // Реклама поверх карточки
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
