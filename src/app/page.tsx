"use client";

import { useEffect, useRef, useState } from "react";
import GameScreen, { type GameMode, type LevelResult } from "@/components/game/GameScreen";
import MapScreen from "@/components/game/MapScreen";
import MenuScreen from "@/components/game/MenuScreen";
import { LEVELS } from "@/components/game/levels";
import { detectLang, saveLang, type Lang } from "@/components/game/i18n";
import {
  awardLevel,
  buyBooster,
  claimDailyGift,
  firstClearOf,
  loadProgress,
  PRICES,
  saveProgress,
  spendBooster,
  START_PROGRESS,
  type BoosterKind,
  type Progress,
  type TipKind,
} from "@/components/game/progress";

/** Сколько монет даёт просмотр рекламы */
const AD_REWARD = 110;

type View = "menu" | "map" | "game";

export default function Home() {
  const [view, setView] = useState<View>("menu");
  const [mode, setMode] = useState<GameMode>("classic");
  const [levelN, setLevelN] = useState(1);
  const [gameKey, setGameKey] = useState(0);
  const [progress, setProgress] = useState<Progress>({ ...START_PROGRESS });
  const [lang, setLang] = useState<Lang>("ru");
  const progressRef = useRef<Progress>(progress);

  // Загрузка прогресса и языка из localStorage (отложенно — внешние данные)
  useEffect(() => {
    const id = window.setTimeout(() => {
      const p = loadProgress();
      progressRef.current = p;
      setProgress(p);
      setLevelN(Math.min(p.unlocked, LEVELS.length));
      setLang(detectLang());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // синхронизируем lang у <html> (скринридеры/браузеры)
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const applyProgress = (mutate: (p: Progress) => Progress | null): void => {
    const next = mutate(progressRef.current);
    if (!next) return;
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  };

  const startLevel = (n: number) => {
    setMode("classic");
    setLevelN(n);
    setGameKey((k) => k + 1);
    setView("game");
  };

  const startEndless = () => {
    setMode("endless");
    setGameKey((k) => k + 1);
    setView("game");
  };

  const toMenu = () => setView("menu");

  const handleLevelEnd = (result: LevelResult, goNext: boolean) => {
    if (result.won) {
      applyProgress((p) => awardLevel(p, result.levelN, result.stars, result.coins));
    }
    if (goNext && result.won && result.levelN < LEVELS.length) {
      setLevelN(result.levelN + 1);
      setGameKey((k) => k + 1);
      // остаёмся в игре на следующем уровне
    } else {
      setView(mode === "endless" ? "menu" : "map");
    }
  };

  const handleExit = () => setView(mode === "endless" ? "menu" : "map");

  const handleUseBooster = (kind: BoosterKind) => {
    applyProgress((p) => spendBooster(p, kind));
  };

  const handleBuy = (kind: BoosterKind): boolean => {
    const price = PRICES[kind];
    const p = progressRef.current;
    if (p.coins < price) return false;
    const next = buyBooster(p, kind);
    if (!next) return false;
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
    return true;
  };

  /** Награда за просмотр рекламы */
  const handleAdReward = (n: number) => {
    const next = { ...progressRef.current, coins: progressRef.current.coins + n };
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
  };

  const handleToggleMute = () => {
    applyProgress((p) => ({ ...p, muted: !p.muted }));
  };

  const handleSetLang = (l: Lang) => {
    saveLang(l);
    setLang(l);
  };

  /** Ежедневный подарок: один раз в день */
  const handleClaimGift = (): boolean => {
    let ok = false;
    applyProgress((p) => {
      const next = claimDailyGift(p);
      if (next) {
        ok = true;
        return next;
      }
      return null;
    });
    return ok;
  };

  const handleTipSeen = (kind: TipKind) => {
    applyProgress((p) => (p.tips[kind] ? p : { ...p, tips: { ...p.tips, [kind]: true } }));
  };

  const handleBestScore = (score: number) => {
    applyProgress((p) => (score <= p.bestEndless ? null : { ...p, bestEndless: score }));
  };

  const level = mode === "endless" ? null : LEVELS[levelN - 1];

  return (
    <>
      {view === "menu" ? (
        <MenuScreen
          progress={progress}
          lang={lang}
          onContinue={startLevel}
          onLevelSelect={() => setView("map")}
          onEndless={startEndless}
          onToggleMute={handleToggleMute}
          onSetLang={handleSetLang}
          onAdReward={handleAdReward}
          onClaimGift={handleClaimGift}
          onBuy={handleBuy}
          adReward={AD_REWARD}
        />
      ) : view === "map" ? (
        <MapScreen
          progress={progress}
          lang={lang}
          onStart={startLevel}
          onBuy={handleBuy}
          onMenu={toMenu}
          onAdReward={handleAdReward}
          adReward={AD_REWARD}
        />
      ) : (
        <GameScreen
          key={`${mode}-${levelN}-${gameKey}`}
          level={level}
          mode={mode}
          best={progress.bestEndless}
          firstClear={mode !== "endless" && firstClearOf(progress, levelN)}
          boosters={progress.boosters}
          coins={progress.coins}
          muted={progress.muted}
          lang={lang}
          tips={progress.tips}
          onToggleMute={handleToggleMute}
          onUseBooster={handleUseBooster}
          onBuyBooster={handleBuy}
          onAdReward={handleAdReward}
          adReward={AD_REWARD}
          onTipSeen={handleTipSeen}
          onLevelEnd={handleLevelEnd}
          onExit={handleExit}
          onBestScore={handleBestScore}
        />
      )}
    </>
  );
}
