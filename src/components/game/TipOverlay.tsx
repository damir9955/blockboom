"use client";

// ── Краткая обучающая подсказка поверх поля (игра на паузе) ────────────────
// Показывается один раз: старт (уровень 1), первая бомба, первый камень.

import { Bomb, Mountain, Sparkles } from "lucide-react";
import { tr, type Lang } from "./i18n";
import type { TipKind } from "./progress";

interface TipOverlayProps {
  lang: Lang;
  kind: TipKind;
  onDismiss: () => void;
}

export default function TipOverlay({ lang, kind, onDismiss }: TipOverlayProps) {
  const t = tr(lang);
  const cfg =
    kind === "start"
      ? {
          Icon: Sparkles,
          iconCls: "bg-gradient-to-br from-amber-400 to-orange-600",
          title: t.tipStartTitle,
          lines: [t.tipStartA, t.tipStartB, t.tipStartC],
          bullet: "bg-amber-400",
          btn: t.tipPlay,
        }
      : kind === "bomb"
        ? {
            Icon: Bomb,
            iconCls: "bg-gradient-to-br from-rose-500 to-red-700",
            title: t.tipBombTitle,
            lines: [t.tipBombA, t.tipBombB, t.tipBombC],
            bullet: "bg-rose-400",
            btn: t.tipGotIt,
          }
        : {
            Icon: Mountain,
            iconCls: "bg-gradient-to-br from-stone-400 to-stone-600",
            title: t.tipStoneTitle,
            lines: [t.tipStoneA, t.tipStoneB, t.tipStoneC],
            bullet: "bg-stone-400",
            btn: t.tipGotIt,
          };
  const { Icon } = cfg;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.tipAria}
    >
      <div className="tip-pop w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-5 text-center shadow-2xl">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-2xl shadow-lg shadow-black/40 ${cfg.iconCls}`}
        >
          <Icon className="size-7 text-white" aria-hidden="true" />
        </span>
        <div className="mt-3 text-xl font-black text-white">{cfg.title}</div>
        <ul className="mt-3 flex flex-col items-start gap-2 text-left">
          {cfg.lines.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm font-bold leading-snug text-white/75">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${cfg.bullet}`} aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 py-3 text-base font-black text-[#221a08] shadow-lg shadow-orange-950/50 transition active:scale-95"
        >
          {cfg.btn}
        </button>
      </div>
    </div>
  );
}
