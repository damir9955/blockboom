"use client";

import { useEffect, useState } from "react";
import { Bomb, X } from "lucide-react";
import { tr, type Lang } from "./i18n";

/** длительность демо-«рекламы», секунд */
export const AD_SECONDS = 5;

interface Props {
  lang: Lang;
  /** сколько монет даёт реклама */
  reward: number;
  /** пользователь досмотрел ролик и нажал «Забрать» */
  onClaim: () => void;
  /** закрыл крестиком до конца — без награды */
  onAbort: () => void;
}

/**
 * Полноэкранная «реклама» за монеты (демо-заглушка: сюда позже встанет реальный ролик).
 * Одна общая кнопка пополнения и в меню, и в магазине во время игры используют этот оверлей.
 * Отсчёт и блокировка кнопки награды живут внутри — родителю нужно только открыть/закрыть.
 */
export default function AdOverlay({ lang, reward, onClaim, onAbort }: Props) {
  const t = tr(lang);
  const [left, setLeft] = useState(AD_SECONDS * 1000);
  const [done, setDone] = useState(false);

  // отсчёт рекламы: 5 секунд, потом кнопка награды
  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      const rest = Math.max(0, AD_SECONDS * 1000 - (performance.now() - started));
      setLeft(rest);
      if (rest <= 0) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, []);

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
            <Bomb className="size-10" aria-hidden="true" />
            <div className="text-lg font-black tracking-wide">{t.appName}</div>
          </div>
        </div>
        <div className="mt-3 text-[11px] leading-snug text-white/40">{t.adNote}</div>
        <div className="mt-4" aria-hidden="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${(1 - left / (AD_SECONDS * 1000)) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs font-bold tabular-nums text-white/50">
            {t.adSeconds(Math.ceil(left / 1000))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClaim}
          disabled={!done}
          className="mt-4 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-sm font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95 disabled:opacity-40"
        >
          {t.adClaim(reward)}
        </button>
      </div>
    </div>
  );
}
