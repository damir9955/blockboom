"use client";

// ── Главное меню: продолжить, выбрать уровень, бесконечный режим, подарок ───

import { useCallback, useRef, useState, type ElementType } from "react";
import {
  Bomb,
  CircleHelp,
  Coins,
  Gift,
  Hammer,
  Infinity as InfinityIcon,
  Mountain,
  Play,
  Plus,
  Settings,
  Shuffle,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { tr, type Lang } from "./i18n";
import { dayNumber, GIFT_REWARD, PRICES, type BoosterKind, type Progress } from "./progress";
import { LEVEL_COUNT, TOTAL_STARS } from "./levels";
import { Sfx, vibrate } from "./sfx";
import CoinsPanel from "./CoinsPanel";
import HelpModal from "./HelpModal";
import BuyConfirm from "./BuyConfirm";

interface Props {
  progress: Progress;
  lang: Lang;
  onContinue: (n: number) => void;
  onLevelSelect: () => void;
  onEndless: () => void;
  onToggleMute: () => void;
  onSetLang: (l: Lang) => void;
  onAdReward: (n: number) => void;
  onClaimGift: () => boolean;
  onBuy: (kind: BoosterKind) => boolean;
  adReward: number;
}

const FLOAT_BLOCKS: { cls: string; style: React.CSSProperties }[] = [
  { cls: "left-[4%] top-[9%] size-12 rounded-2xl bg-gradient-to-br from-rose-400/20 to-rose-600/25", style: { animationDelay: "0s" } },
  { cls: "right-[7%] top-[16%] size-9 rounded-xl bg-gradient-to-br from-amber-300/20 to-orange-500/25", style: { animationDelay: "1.2s" } },
  { cls: "left-[10%] top-[42%] size-8 rounded-xl bg-gradient-to-br from-emerald-400/15 to-emerald-600/20", style: { animationDelay: "2.1s" } },
  { cls: "right-[5%] top-[52%] size-14 rounded-2xl bg-gradient-to-br from-sky-400/15 to-indigo-500/20", style: { animationDelay: "0.6s" } },
  { cls: "left-[16%] bottom-[16%] size-10 rounded-xl bg-gradient-to-br from-violet-400/15 to-violet-600/20", style: { animationDelay: "1.7s" } },
  { cls: "right-[14%] bottom-[10%] size-8 rounded-xl bg-gradient-to-br from-lime-400/15 to-lime-600/20", style: { animationDelay: "2.6s" } },
];

export default function MenuScreen({
  progress,
  lang,
  onContinue,
  onLevelSelect,
  onEndless,
  onToggleMute,
  onSetLang,
  onAdReward,
  onClaimGift,
  onBuy,
  adReward,
}: Props) {
  const t = tr(lang);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [buyKind, setBuyKind] = useState<BoosterKind | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const getSfx = useCallback((): Sfx => {
    if (!sfxRef.current) sfxRef.current = new Sfx();
    sfxRef.current.muted = progress.muted;
    return sfxRef.current;
  }, [progress.muted]);

  const stars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const continueLevel = Math.min(progress.unlocked, LEVEL_COUNT);
  const doneLevels = Math.min(Object.keys(progress.stars).length, LEVEL_COUNT);
  const allDone = doneLevels >= LEVEL_COUNT;
  const giftReady = progress.giftDay < dayNumber();

  const shopItems: {
    kind: BoosterKind;
    label: string;
    Icon: ElementType;
    price: number;
    count: number;
    tone: string;
  }[] = [
    { kind: "hammer", label: t.hammer, Icon: Hammer, price: PRICES.hammer, count: progress.boosters.hammer, tone: "bg-rose-500" },
    { kind: "shuffle", label: t.shuffle, Icon: Shuffle, price: PRICES.shuffle, count: progress.boosters.shuffle, tone: "bg-teal-500" },
    { kind: "plus5", label: `+${t.plus5}`, Icon: Plus, price: PRICES.plus5, count: progress.boosters.plus5, tone: "bg-amber-500" },
  ];
  const buyItem = shopItems.find((i) => i.kind === buyKind) ?? null;

  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col items-center overflow-hidden bg-[#131118] bg-gradient-to-b from-[#1d1828] via-[#141219] to-[#0f0e14] text-white select-none"
      aria-label={t.menuAria}
    >
      {/* декоративный фон */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-[-30%] top-[-18%] h-[62%] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.16),transparent_65%)]" />
        <div className="absolute inset-x-[-20%] bottom-[-25%] h-[55%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),transparent_65%)]" />
        {FLOAT_BLOCKS.map((b, i) => (
          <span key={i} className={`float-block absolute ${b.cls}`} style={b.style} />
        ))}
      </div>

      <main className="relative flex w-full max-w-[420px] flex-1 flex-col px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),14px)]">
        {/* шапка: звёзды и монеты */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-black text-amber-200 tabular-nums"
            aria-label={t.menuFooterStars(stars, TOTAL_STARS)}
          >
            <Star className="size-4 text-amber-400" fill="currentColor" aria-hidden="true" />
            {stars}
            <span className="text-[10px] font-bold text-white/30">/ {TOTAL_STARS}</span>
          </div>
          <button
            type="button"
            onClick={() => setCoinsOpen(true)}
            aria-label={t.coinsOpenAria}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3.5 py-1.5 text-sm font-black text-amber-300 tabular-nums transition active:scale-90 hover:bg-amber-400/20"
          >
            <Coins className="size-4" aria-hidden="true" />
            {progress.coins}
          </button>
        </div>

        {/* логотип */}
        <header className="flex flex-col items-center pb-5 pt-6">
          <span className="grid size-[72px] rotate-3 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-orange-950/50">
            <Bomb className="size-9 -rotate-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-[34px] font-black leading-none tracking-wide text-white drop-shadow-[0_4px_16px_rgba(251,191,36,0.35)]">
            {t.appName}
          </h1>
        </header>

        {/* подарок + магазин инструментов */}
        <section
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 shadow-xl shadow-black/30"
          aria-label={t.giftSectionAria}
        >
          {giftReady ? (
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 gift-pulse shadow-lg">
                <Gift className="size-5 text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white">{t.giftTitle}</div>
                <div className="text-[11px] font-medium text-white/40">{t.coinsTotal}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onClaimGift()) {
                    getSfx().coin();
                    vibrate([15, 30, 15]);
                  }
                }}
                aria-label={t.giftAria(GIFT_REWARD)}
                className="shrink-0 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 px-3.5 py-2.5 text-xs font-black text-[#221a08] shadow-md shadow-orange-950/40 transition active:scale-95"
              >
                {t.giftClaim(GIFT_REWARD)}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 opacity-75">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5">
                <Gift className="size-5 text-white/40" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-black text-white/60">{t.giftTitle}</div>
                <div className="text-[11px] font-medium text-white/35">{t.giftClaimed}</div>
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {shopItems.map(({ kind, label, Icon, price, count, tone }) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  if (progress.coins >= price) setBuyKind(kind);
                  else setCoinsOpen(true);
                }}
                aria-label={t.buyAria(label, price, count)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 transition active:scale-95 hover:bg-white/10"
              >
                <span className="relative">
                  <span className={`grid size-9 place-items-center rounded-lg ${tone} shadow-md`}>
                    <Icon className="size-5 text-white" aria-hidden="true" />
                  </span>
                  <span className="absolute -right-2 -top-1.5 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-black">
                    {count}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-white/60">{label}</span>
                <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-300 tabular-nums">
                  <Coins className="size-3" aria-hidden="true" />
                  {price}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* кнопки режимов */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onContinue(continueLevel)}
            aria-label={t.menuContinueAria(continueLevel)}
            className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 py-4 shadow-xl shadow-orange-950/50 transition active:scale-95"
          >
            <span className="flex items-center gap-2.5 text-xl font-black text-[#221a08]">
              <Play className="size-6 fill-[#221a08]" aria-hidden="true" />
              {t.menuContinue}
            </span>
            <span className="mt-0.5 text-[11px] font-bold text-[#221a08]/70">
              {allDone ? t.menuContinueAll : t.menuLevelSub(continueLevel)}
            </span>
          </button>
          <button
            type="button"
            onClick={onLevelSelect}
            aria-label={t.menuLevelSelectAria}
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] py-3.5 text-base font-black text-white/90 transition active:scale-95 hover:bg-white/[0.12]"
          >
            <Mountain className="size-5 text-amber-300" aria-hidden="true" />
            {t.menuLevelSelect}
          </button>
          <button
            type="button"
            onClick={onEndless}
            aria-label={t.menuEndlessAria}
            className="flex flex-col items-center rounded-2xl border border-sky-400/25 bg-gradient-to-b from-sky-500/20 to-indigo-600/20 py-3.5 shadow-lg shadow-sky-950/40 transition active:scale-95 hover:from-sky-500/30"
          >
            <span className="flex items-center gap-2.5 text-lg font-black text-white">
              <InfinityIcon className="size-6 text-sky-300" aria-hidden="true" />
              {t.menuEndless}
            </span>
            <span className="mt-0.5 text-[11px] font-bold text-white/45">
              {t.menuEndlessSub(progress.bestEndless)}
            </span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t.menuHelpAria}
              className="flex items-center justify-center gap-2 rounded-2xl border border-sky-400/25 bg-sky-400/10 py-3 text-sm font-black text-sky-300 transition active:scale-95 hover:bg-sky-400/20"
            >
              <CircleHelp className="size-4.5" aria-hidden="true" />
              {t.menuHelp}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t.menuSettingsAria}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] py-3 text-sm font-black text-white/80 transition active:scale-95 hover:bg-white/[0.12]"
            >
              <Settings className="size-4.5" aria-hidden="true" />
              {t.menuSettings}
            </button>
          </div>
        </div>

        <footer className="mt-auto pt-5 text-center text-[11px] font-bold tracking-wide text-white/30">
          {t.menuFooterLevels(doneLevels, LEVEL_COUNT)} · {t.menuFooterStars(stars, TOTAL_STARS)}
        </footer>
      </main>

      {coinsOpen && (
        <CoinsPanel
          lang={lang}
          coins={progress.coins}
          reward={adReward}
          onAdReward={onAdReward}
          onClose={() => setCoinsOpen(false)}
        />
      )}

      {helpOpen && <HelpModal lang={lang} onClose={() => setHelpOpen(false)} />}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t.settingsTitle}
        >
          <div className="tip-pop w-[86%] max-w-xs rounded-2xl border border-white/10 bg-[#1c1a24] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black uppercase tracking-widest text-white/70">{t.settingsTitle}</div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                aria-label={t.close}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 transition active:scale-90 hover:bg-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center gap-2.5 text-sm font-bold text-white/80">
                {progress.muted ? (
                  <VolumeX className="size-5 text-white/45" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-5 text-emerald-400" aria-hidden="true" />
                )}
                {t.settingsSound}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!progress.muted}
                aria-label={progress.muted ? t.soundOnAria : t.soundOffAria}
                onClick={onToggleMute}
                className={`relative h-7 w-12 rounded-full transition ${progress.muted ? "bg-white/15" : "bg-emerald-500"}`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${
                    progress.muted ? "left-1" : "left-6"
                  }`}
                />
              </button>
            </div>
            <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-sm font-bold text-white/80">{t.settingsLang}</div>
              <div className="mt-2.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.settingsLangAria}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={lang === "ru"}
                  onClick={() => onSetLang("ru")}
                  className={`rounded-xl py-2.5 text-sm font-black transition active:scale-95 ${
                    lang === "ru"
                      ? "bg-gradient-to-b from-amber-400 to-orange-500 text-[#221a08] shadow-md"
                      : "border border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  Русский
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={lang === "en"}
                  onClick={() => onSetLang("en")}
                  className={`rounded-xl py-2.5 text-sm font-black transition active:scale-95 ${
                    lang === "en"
                      ? "bg-gradient-to-b from-amber-400 to-orange-500 text-[#221a08] shadow-md"
                      : "border border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {buyItem && (
        <BuyConfirm
          lang={lang}
          name={buyItem.label}
          price={buyItem.price}
          count={buyItem.count}
          tone={buyItem.tone}
          icon={<buyItem.Icon className="size-6 text-white" aria-hidden="true" />}
          onConfirm={() => {
            if (onBuy(buyItem.kind)) {
              getSfx().coin();
              vibrate(12);
            }
            setBuyKind(null);
          }}
          onCancel={() => setBuyKind(null)}
        />
      )}
    </div>
  );
}
