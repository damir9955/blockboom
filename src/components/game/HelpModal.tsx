"use client";

// ── Помощь: правила игры и каждой механики по отдельности, с картинками ─────

import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bomb,
  Coins,
  Flame,
  Gift,
  Hammer,
  Heart,
  Infinity as InfinityIcon,
  Map as MapIcon,
  Mountain,
  Plus,
  Shuffle,
  Star,
  X,
} from "lucide-react";
import { tr, type Lang } from "./i18n";

interface HelpModalProps {
  lang: Lang;
  onClose: () => void;
}

/** Клетка мини-поля для картинок */
function Cell({
  tone = "empty",
  glow = false,
  className = "",
}: {
  tone?: string;
  glow?: boolean;
  className?: string;
}) {
  const tones: Record<string, string> = {
    empty: "bg-white/[0.07]",
    rose: "bg-gradient-to-b from-rose-300 to-rose-500",
    amber: "bg-gradient-to-b from-amber-300 to-amber-500",
    emerald: "bg-gradient-to-b from-emerald-300 to-emerald-500",
    sky: "bg-gradient-to-b from-sky-300 to-sky-500",
    violet: "bg-gradient-to-b from-violet-300 to-violet-500",
    orange: "bg-gradient-to-b from-orange-300 to-orange-500",
    lime: "bg-gradient-to-b from-lime-300 to-lime-500",
    stone: "bg-gradient-to-b from-stone-300 to-stone-500",
  };
  return (
    <span
      className={`size-3.5 rounded-[4px] ${tones[tone] ?? tones.empty} ${
        glow ? "ring-2 ring-amber-200/90 shadow-[0_0_10px_rgba(251,191,36,0.55)]" : ""
      } ${className}`}
      aria-hidden="true"
    />
  );
}

/** Мини-поле 5×5 */
function MiniGrid({ cells }: { cells: string[] }) {
  return (
    <div className="grid grid-cols-5 gap-[3px]">
      {cells.map((tone, i) => (
        <Cell key={i} tone={tone === "glow" ? "amber" : tone} glow={tone === "glow"} />
      ))}
    </div>
  );
}

/** Клетка-бомба с искрой */
function BombCell() {
  return (
    <span
      className="relative size-3.5 rounded-[4px] bg-stone-900 ring-1 ring-rose-400/50"
      aria-hidden="true"
    >
      <span className="absolute -right-0.5 -top-0.5 size-1 rounded-full bg-amber-300" />
    </span>
  );
}

/** Камень: гладкий / в трещинах / разбит */
function StoneStage({ stage }: { stage: 0 | 1 | 2 }) {
  if (stage === 2) {
    return (
      <span
        className="grid size-5 place-items-center rounded-md border border-dashed border-stone-500/60"
        aria-hidden="true"
      >
        <span className="flex gap-[2px]">
          <span className="size-[3px] rounded-full bg-stone-400" />
          <span className="size-[3px] rounded-full bg-stone-500" />
        </span>
      </span>
    );
  }
  return (
    <span
      className="relative size-5 rounded-md bg-gradient-to-b from-stone-300 to-stone-500 shadow-inner"
      aria-hidden="true"
    >
      {stage === 1 && (
        <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full">
          <path
            d="M4 2 L10 9 L7 18 M16 3 L11 11 L15 17 M8 1 L9 7 L13 6"
            stroke="#1c1917"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

function Section({ title, text, pic }: { title: string; text: string; pic: ReactNode }) {
  return (
    <section className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-1.5">{pic}</div>
      <div className="min-w-0">
        <div className="text-sm font-black text-white">{title}</div>
        <p className="mt-1 text-xs font-medium leading-relaxed text-white/55">{text}</p>
      </div>
    </section>
  );
}

export default function HelpModal({ lang, onClose }: HelpModalProps) {
  const t = tr(lang);

  const goalChip = (
    icon: ReactNode,
    label: string,
    now: string,
  ): ReactNode => (
    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-black text-white/70">
      {icon}
      <span className="truncate">
        {label} <span className="text-amber-300 tabular-nums">{now}</span>
      </span>
    </span>
  );

  const sections: { title: string; text: string; pic: ReactNode }[] = [
    {
      title: t.helpBasicsTitle,
      text: t.helpBasicsText,
      pic: (
        <>
          <div className="grid rotate-[-4deg] grid-cols-2 gap-[3px]">
            <Cell tone="amber" />
            <Cell tone="amber" />
            <Cell tone="amber" />
            <Cell tone="amber" />
          </div>
          <ArrowDown className="size-3.5 text-white/40" aria-hidden="true" />
          <MiniGrid
            cells={[
              "empty", "rose", "empty", "emerald", "empty",
              "empty", "empty", "amber", "empty", "empty",
              "sky", "empty", "violet", "empty", "empty",
              "empty", "orange", "empty", "empty", "lime",
              "empty", "empty", "empty", "rose", "empty",
            ]}
          />
        </>
      ),
    },
    {
      title: t.helpModesTitle,
      text: t.helpModesText,
      pic: (
        <div className="flex w-full flex-col gap-1.5">
          <span className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 text-[10px] font-black text-amber-300">
            <MapIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.menuClassic}</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/10 px-2 py-1.5 text-[10px] font-black text-sky-300">
            <InfinityIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t.menuEndless}</span>
          </span>
        </div>
      ),
    },
    {
      title: t.helpGoalsTitle,
      text: t.helpGoalsText,
      pic: (
        <div className="flex w-full flex-col gap-1.5">
          {goalChip(<Flame className="size-3.5 shrink-0 text-orange-400" aria-hidden="true" />, t.goalLines, "0/3")}
          {goalChip(<Star className="size-3.5 shrink-0 text-amber-400" aria-hidden="true" />, t.goalScore, "0/600")}
          {goalChip(<Bomb className="size-3.5 shrink-0 text-rose-400" aria-hidden="true" />, t.goalDefuse, "0/2")}
          {goalChip(<Mountain className="size-3.5 shrink-0 text-stone-300" aria-hidden="true" />, t.goalStones, "0/2")}
        </div>
      ),
    },
    {
      title: t.helpLinesTitle,
      text: t.helpLinesText,
      pic: (
        <>
          <MiniGrid
            cells={[
              "empty", "rose", "empty", "emerald", "empty",
              "empty", "empty", "amber", "empty", "empty",
              "sky", "empty", "violet", "empty", "empty",
              "glow", "glow", "glow", "glow", "glow",
            ]}
          />
          <span className="mt-0.5 flex items-center gap-1">
            <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-black text-orange-300">
              ×2
            </span>
            <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-black text-rose-300">
              ×4
            </span>
            <span className="rounded-full bg-red-500/25 px-1.5 py-0.5 text-[9px] font-black text-red-300">
              ×6
            </span>
          </span>
        </>
      ),
    },
    {
      title: t.helpBombsTitle,
      text: t.helpBombsText,
      pic: (
        <>
          <div className="grid grid-cols-5 gap-[3px]">
            <Cell tone="empty" />
            <Cell tone="rose" />
            <Cell tone="empty" />
            <Cell tone="empty" />
            <Cell tone="violet" />
            <Cell tone="glow" />
            <Cell tone="glow" />
            <BombCell />
            <Cell tone="glow" />
            <Cell tone="glow" />
            <Cell tone="empty" />
            <Cell tone="emerald" />
            <Cell tone="empty" />
            <Cell tone="empty" />
            <Cell tone="empty" />
          </div>
          <span className="flex items-center gap-1">
            <Heart className="size-3.5 text-rose-500" fill="currentColor" aria-hidden="true" />
            <Heart className="size-3.5 text-rose-500" fill="currentColor" aria-hidden="true" />
            <Heart className="size-3.5 text-white/15" aria-hidden="true" />
          </span>
        </>
      ),
    },
    {
      title: t.helpStonesTitle,
      text: t.helpStonesText,
      pic: (
        <div className="flex items-center gap-1">
          <StoneStage stage={0} />
          <ArrowRight className="size-3 text-white/40" aria-hidden="true" />
          <StoneStage stage={1} />
          <ArrowRight className="size-3 text-white/40" aria-hidden="true" />
          <StoneStage stage={2} />
        </div>
      ),
    },
    {
      title: t.helpCollectTitle,
      text: t.helpCollectText,
      pic: (
        <>
          <MiniGrid
            cells={[
              "empty", "empty", "emerald", "empty", "empty",
              "empty", "amber", "empty", "empty", "rose",
              "empty", "empty", "empty", "emerald", "empty",
              "sky", "empty", "empty", "empty", "empty",
              "empty", "violet", "empty", "empty", "empty",
            ]}
          />
          <span className="mt-0.5 flex items-center gap-1.5">
            <Cell tone="emerald" glow />
            <span className="text-[10px] font-black text-emerald-300 tabular-nums">2/12</span>
          </span>
        </>
      ),
    },
    {
      title: t.helpToolsTitle,
      text: t.helpToolsText,
      pic: (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-rose-500 shadow-md">
              <Hammer className="size-4 text-white" aria-hidden="true" />
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-500 shadow-md">
              <Shuffle className="size-4 text-white" aria-hidden="true" />
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-amber-500 shadow-md">
              <Plus className="size-4 text-white" aria-hidden="true" />
            </span>
          </span>
        </div>
      ),
    },
    {
      title: t.helpCoinsTitle,
      text: t.helpCoinsText,
      pic: (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">
            <Coins className="size-3" aria-hidden="true" /> +30
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/70">
            <Star className="size-3 text-amber-400" fill="currentColor" aria-hidden="true" /> ★★
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
            <Gift className="size-3" aria-hidden="true" /> +50
          </span>
        </div>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.helpTitle}
    >
      <div className="tip-pop flex h-[88dvh] w-[92%] max-w-sm flex-col rounded-2xl border border-white/10 bg-[#1c1a24] shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 shadow-md">
              <Flame className="size-4 text-white" aria-hidden="true" />
            </span>
            <div className="text-base font-black uppercase tracking-widest text-white/80">{t.helpTitle}</div>
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
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3 pb-5 [scrollbar-width:thin]">
          {sections.map((s) => (
            <Section key={s.title} title={s.title} text={s.text} pic={s.pic} />
          ))}
        </div>
      </div>
    </div>
  );
}
