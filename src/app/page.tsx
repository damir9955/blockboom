"use client";

import { useEffect, useRef, useState } from "react";
import GameScreen, { type LevelResult } from "@/components/game/GameScreen";
import MainMenu from "@/components/game/MainMenu";
import MapScreen from "@/components/game/MapScreen";
import { LEVELS } from "@/components/game/levels";
import { detectLang, saveLang, type Lang } from "@/components/game/i18n";
import {
  awardLevel,
  buyBooster,
  claimDailyGift,
  firstClearOf,
  loadProgress,
  markTipSeen,
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
  const handleMenu = () => setView("menu");

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

  /** Подарок за ежедневный вход; false — уже забран сегодня */
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

  /** Отметить краткую подсказку показанной (показываем один раз) */
  const handleTipSeen = (kind: TipKind) => {
    applyProgress((p) => markTipSeen(p, kind));
  };

  const handleToggleMute = () => {
    applyProgress((p) => ({ ...p, muted: !p.muted }));
  };

  const handleSetLang = (l: Lang) => {
    saveLang(l);
    setLang(l);
  };

  const level = LEVELS[levelN - 1];

  return (
    <>
      {view === "menu" ? (
        <MainMenu
          progress={progress}
          lang={lang}
          onContinue={startLevel}
          onLevelSelect={() => setView("map")}
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
          onMenu={handleMenu}
          onAdReward={handleAdReward}
          adReward={AD_REWARD}
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
          tips={progress.tips}
          onToggleMute={handleToggleMute}
          onUseBooster={handleUseBooster}
          onBuyBooster={handleBuy}
          onAdReward={handleAdReward}
          adReward={AD_REWARD}
          onTipSeen={handleTipSeen}
          onLevelEnd={handleLevelEnd}
          onExit={handleExit}
        />
      )}
    </>
  );
}
