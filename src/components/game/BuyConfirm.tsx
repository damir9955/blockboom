"use client";

import type { ReactNode } from "react";
import { Coins } from "lucide-react";
import { tr, type Lang } from "./i18n";

interface Props {
  lang: Lang;
  /** название предмета */
  name: string;
  /** цена в монетах */
  price: number;
  /** сколько уже есть у игрока */
  count: number;
  /** тон плашки иконки (bg-rose-500 / bg-teal-500 / bg-amber-500) */
  tone: string;
  /** иконка предмета */
  icon: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Диалог покупки: «Купить X за N монет?» — защита от случайного тапа.
 * Единый диалог и для магазина в главном меню, и для магазина во время игры.
 */
export default function BuyConfirm({ lang, name, price, count, tone, icon, onConfirm, onCancel }: Props) {
  const t = tr(lang);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.confirmBuyText(name, price)}
    >
      <div className="w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-5 text-center shadow-2xl">
        <div className="flex items-center justify-center gap-4">
          <span className="relative shrink-0">
            <span className={`grid size-12 place-items-center rounded-lg ${tone}`}>{icon}</span>
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
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-sm font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95"
        >
          {t.buy}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-bold text-white/70 transition active:scale-95 hover:bg-white/10"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
