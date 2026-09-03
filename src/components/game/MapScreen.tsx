"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import { ArrowLeft, Bomb, Coins, Hammer, Lock, Play, Plus, Shuffle, Star } from "lucide-react";
import { tr, type Lang } from "./i18n";
import { LEVELS, LEVEL_COUNT, levelHint } from "./levels";
import { PRICES, totalStars, type BoosterKind, type Progress } from "./progress";
import BuyConfirm from "./BuyConfirm";
import CoinsModal from "./CoinsModal";

interface Props {
  progress: Progress;
  lang: Lang;
  onStart: (n: number) => void;
  onBuy: (kind: BoosterKind) => boolean;
  /** вернуться в главное меню */
  onMenu: () => void;
  onAdReward: (n: number) => void;
  adReward: number;
}

/** Змейка-тропа: 3 узла в ряд, направление чередуется */
function nodePos(n: number): { x: number; y: number } {
  const row = Math.floor((n - 1) / 3);
  const inRow = (n - 1) % 3;
  const slots = [18, 50, 82];
  const x = row % 2 === 0 ? slots[inRow] : slots[2 - inRow];
  const y = 40 + row * 112;
  return { x, y };
}

const NODE_H = 92 + Math.ceil(LEVEL_COUNT / 3) * 112;

export default function MapScreen({ progress, lang, onStart, onBuy, onMenu, onAdReward, adReward }: Props) {
  const t = tr(lang);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const [lockedShake, setLockedShake] = useState(0);
  const [pendingKind, setPendingKind] = useState<BoosterKind | null>(null);
  const [coinsOpen, setCoinsOpen] = useState(false);

  // автоскролл к текущему уровню
  useEffect(() => {
    const el = currentRef.current;
    const box = scrollRef.current;
    if (el && box) {
      const top = el.offsetTop - box.clientHeight / 2 + 46;
      box.scrollTo({ top: Math.max(0, top), behavior: "instant" as ScrollBehavior });
    }
  }, []);

  const stars = totalStars(progress);
  const current = Math.min(progress.unlocked, LEVEL_COUNT);

  const handleNode = (n: number) => {
    if (n > progress.unlocked) {
      setLockedShake(n);
      window.setTimeout(() => setLockedShake(0), 500);
      return;
    }
    onStart(n);
  };

  // точки ломаной тропы
  const points = LEVELS.map((l) => nodePos(l.n));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const boosters: { kind: BoosterKind; label: string; Icon: ElementType; price: number; count: number; tone: string }[] = [
    { kind: "hammer", label: t.hammer, Icon: Hammer, price: PRICES.hammer, count: progress.boosters.hammer, tone: "bg-rose-500" },
    { kind: "shuffle", label: t.shuffle, Icon: Shuffle, price: PRICES.shuffle, count: progress.boosters.shuffle, tone: "bg-teal-500" },
    { kind: "plus5", label: `+${t.plus5}`, Icon: Plus, price: PRICES.plus5, count: progress.boosters.plus5, tone: "bg-amber-500" },
  ];
  const pendingItem = boosters.find((b) => b.kind === pendingKind) ?? null;
  const PendingIcon = pendingItem?.Icon;

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center overflow-hidden bg-[#131118] bg-gradient-to-b from-[#1d1828] via-[#141219] to-[#0f0e14] text-white select-none">
      <main className="flex w-full max-w-[420px] flex-1 flex-col overflow-hidden px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)]">
        {/* Шапка: назад в меню, лого, монеты */}
        <header className="flex items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={onMenu}
              aria-label={t.backToMenuAria}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/70 transition active:scale-90 hover:bg-white/10"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-950/40">
              <Bomb className="size-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-black leading-none tracking-wide">{t.appName}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] leading-none text-white/40">
                <Star className="size-3 text-amber-400/80" aria-hidden="true" fill="currentColor" />
                {stars} / {LEVEL_COUNT * 3} · {t.levelsWord} {progress.unlocked > LEVEL_COUNT ? t.allWord : `${current}/${LEVEL_COUNT}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCoinsOpen(true)}
            aria-label={t.coinsOpenAria}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3.5 py-1.5 text-sm font-black text-amber-300 tabular-nums transition active:scale-90 hover:bg-amber-400/20"
          >
            <Coins className="size-4" aria-hidden="true" />
            <span key={progress.coins} className="score-pop">{progress.coins}</span>
          </button>
        </header>

        {/* Тропа уровней */}
        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-black/20 [scrollbar-width:thin]"
          role="list"
          aria-label={t.levelMapAria}
        >
          <div className="relative mx-auto w-full" style={{ height: NODE_H }}>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 100 ${NODE_H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={pathD}
                fill="none"
                stroke="#2c2838"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="0.2 3.4"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {LEVELS.map((l) => {
              const p = nodePos(l.n);
              const st = progress.stars[String(l.n)];
              const done = st !== undefined;
              const locked = l.n > progress.unlocked;
              const isCurrent = !done && l.n === current;
              return (
                <button
                  key={l.n}
                  ref={isCurrent ? currentRef : undefined}
                  type="button"
                  role="listitem"
                  onClick={() => handleNode(l.n)}
                  aria-label={
                    locked
                      ? t.levelLockedAria(l.n)
                      : `${done ? t.levelDoneAria(l.n, st ?? 0) : t.levelNChip(l.n)}. ${levelHint(l, lang)}`
                  }
                  className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                  style={{ left: `${p.x}%`, top: p.y }}
                >
                  <span
                    className={`grid place-items-center rounded-full border-2 font-black shadow-lg transition active:scale-90 ${
                      locked
                        ? "size-14 border-white/8 bg-[#1c1926] text-white/25"
                        : done
                          ? "size-16 border-emerald-500/40 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white"
                          : "size-20 border-amber-300/70 bg-gradient-to-b from-amber-400 to-orange-600 text-white shadow-amber-900/50 node-pulse"
                    } ${lockedShake === l.n ? "anim-shake" : ""}`}
                  >
                    {locked ? (
                      <Lock className="size-6" aria-hidden="true" />
                    ) : isCurrent ? (
                      <Play className="size-8" aria-hidden="true" fill="currentColor" />
                    ) : (
                      <span className={done ? "text-xl" : "text-xl"}>{l.n}</span>
                    )}
                  </span>
                  {done && (
                    <span className="mt-1.5 flex justify-center gap-0.5" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${i < (st ?? 0) ? "text-amber-300" : "text-white/15"}`}
                          fill={i < (st ?? 0) ? "currentColor" : "none"}
                        />
                      ))}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-bold text-amber-300">
                      {t.levelNChip(l.n)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Магазин бустеров (пополнение монет — по тапу на монеты в шапке) */}
        <section className="mt-3" aria-label={t.boosterShopAria}>
          <div className="grid grid-cols-3 gap-2">
            {boosters.map(({ kind, label, Icon, price, count, tone }) => {
              const afford = progress.coins >= price;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => (afford ? setPendingKind(kind) : setCoinsOpen(true))}
                  aria-disabled={!afford}
                  aria-label={t.buyAria(label, price, count)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 transition active:scale-95 hover:bg-white/10 aria-disabled:opacity-40"
                >
                  <span className="relative">
                    <span className={`grid size-9 place-items-center rounded-lg ${tone}`}>
                      <Icon className="size-5 text-white" aria-hidden="true" />
                    </span>
                    <span className="absolute -right-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black">
                      {count}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-white/70">{label}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-black text-amber-300 tabular-nums">
                    <Coins className="size-3" aria-hidden="true" />
                    {price}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {/* Подтверждение покупки */}
      {pendingItem && PendingIcon && (
        <BuyConfirm
          lang={lang}
          name={pendingItem.label}
          price={pendingItem.price}
          count={pendingItem.count}
          tone={pendingItem.tone}
          icon={<PendingIcon className="size-6 text-white" aria-hidden="true" />}
          onConfirm={() => {
            onBuy(pendingItem.kind);
            setPendingKind(null);
          }}
          onCancel={() => setPendingKind(null)}
        />
      )}

      {/* Монеты: баланс и пополнение за рекламу */}
      {coinsOpen && (
        <CoinsModal
          lang={lang}
          coins={progress.coins}
          reward={adReward}
          onAdReward={onAdReward}
          onClose={() => setCoinsOpen(false)}
        />
      )}
    </div>
  );
}
