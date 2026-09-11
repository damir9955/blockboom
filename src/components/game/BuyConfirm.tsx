"use client";

// ── Подтверждение покупки бустера (без заголовка — сразу суть) ───────────────

import type { ReactNode } from "react";
import { Coins } from "lucide-react";
import { tr, type Lang } from "./i18n";

interface BuyConfirmProps {
  lang: Lang;
  name: string;
  price: number;
  count: number;
  tone: string;
  icon: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function BuyConfirm({ lang, name, price, count, tone, icon, onConfirm, onCancel }: BuyConfirmProps) {
  const t = tr(lang);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.confirmBuyText(name, price)}
    >
      <div className="panel tip-pop w-[86%] max-w-xs rounded-2xl p-5 text-center">
        <div className="flex items-center justify-center gap-4">
          <span className="relative shrink-0">
            <span className={`grid size-12 place-items-center rounded-lg shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_16px_rgba(0,0,0,0.45)] ${tone}`}>{icon}</span>
            <span
              className="absolute -right-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black"
              aria-label={t.have(count)}
            >
              {count}
            </span>
          </span>
          <div className="min-w-0 text-left">
            <div className="truncate text-base font-black text-white">{name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-black text-amber-300 tabular-nums">
              <Coins className="size-4" aria-hidden="true" />
              {price}
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm font-bold leading-snug text-white/75">{t.confirmBuyText(name, price)}</div>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-gold mt-5 w-full rounded-xl py-3 text-sm font-black"
        >
          {t.buy}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-glass mt-2 w-full rounded-xl py-2.5 text-sm font-bold text-white/70"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
