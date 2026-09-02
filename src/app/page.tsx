"use client";

import { useEffect, useRef, useState } from "react";
import GameScreen, { type LevelResult } from "@/components/game/GameScreen";
import MapScreen from "@/components/game/MapScreen";
import { LEVELS } from "@/components/game/levels";
import { detectLang, saveLang, type Lang } from "@/components/game/i18n";
import {
  AD_COIN_REWARD,
  awardLevel,
  buyBooster,
  firstClearOf,
  loadProgress,
  saveProgress,
  spendBooster,
  START_PROGRESS,
  type BoosterKind,
  type Progress,
} from "@/components/game/progress";

type View = "map" | "game";

export default function Home() {
  const [view, setView] = useState<View>("map");
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
    setLevelN(n);
    setGameKey((k) => k + 1);
    setView("game");
  };

  const handleLevelEnd = (result: LevelResult, goNext: boolean) => {
    if (result.won) {
      applyProgress((p) => awardLevel(p, result.levelN, result.stars, result.coins));
    }
    if (goNext && result.won && result.levelN < LEVELS.length) {
      setLevelN(result.levelN + 1);
      setGameKey((k) => k + 1);
      // остаёмся в игре на следующем уровне
    } else {
      setView("map");
    }
  };

  const handleExit = () => setView("map");

  const handleUseBooster = (kind: BoosterKind) => {
    applyProgress((p) => spendBooster(p, kind));
  };

  const handleBuy = (kind: BoosterKind): boolean => {
    // покупка прямо в игре: false — не хватило монет (тогда игра предложит рекламу)
    const next = buyBooster(progressRef.current, kind);
    if (!next) return false;
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
    return true;
  };

  /** Награда за просмотр рекламы: +N монет; возвращает новый баланс */
  const handleAdReward = (reward: number): number => {
    const next = { ...progressRef.current, coins: progressRef.current.coins + reward };
    progressRef.current = next;
    setProgress(next);
    saveProgress(next);
    return next.coins;
  };

  const handleToggleMute = () => {
    applyProgress((p) => ({ ...p, muted: !p.muted }));
  };

  const handleToggleLang = () => {
    setLang((prev) => {
      const next = prev === "ru" ? "en" : "ru";
      saveLang(next);
      return next;
    });
  };

  const level = LEVELS[levelN - 1];

  return (
    <>
      {view === "map" ? (
        <MapScreen
          progress={progress}
          lang={lang}
          onToggleLang={handleToggleLang}
          onStart={startLevel}
          onBuy={handleBuy}
          onToggleMute={handleToggleMute}
          onAdReward={handleAdReward}
          adReward={AD_COIN_REWARD}
        />
      ) : (
        <GameScreen
          key={`${levelN}-${gameKey}`}
          level={level}
          firstClear={firstClearOf(progress, levelN)}
          boosters={progress.boosters}
          coins={progress.coins}
          muted={progress.muted}
          lang={lang}
          onToggleMute={handleToggleMute}
          onUseBooster={handleUseBooster}
          onBuyBooster={handleBuy}
          onAdReward={handleAdReward}
          adReward={AD_COIN_REWARD}
          onLevelEnd={handleLevelEnd}
          onExit={handleExit}
        />
      )}
    </>
  );
}
