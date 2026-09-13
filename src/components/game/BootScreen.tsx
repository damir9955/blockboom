"use client";

// ── Экран первой загрузки: скачать ВСЮ игру на устройство до старта ────────
//
// Логика (по ТЗ):
//  1. Повторный запуск: спрашиваем у Service Worker «файл-маркер»
//     (/__bb_installed__ в Cache Storage). Маркер есть → мгновенный старт.
//  2. Маркера нет → SW скачивает все файлы (progress-сообщения сюда),
//     полоска загрузки растёт, в конце создаётся маркер → стартуем.
//  3. Есть обновление → новый SW качает его в фоне, пока играем;
//     применяется при СЛЕДУЮЩЕМ запуске (этот экран не увидит подмены).
//  4. Сбой сети → «Повторить» (докачка: уже скачанные файлы пропускаются).

import { useCallback, useEffect, useRef, useState } from "react";
import { detectLang, type Lang } from "./i18n";

export const APP_VERSION = "1.8.5";

type Phase =
  | { kind: "checking" }
  | {
      kind: "downloading";
      pct: number;
      done: number;
      total: number;
      loadedBytes: number;
      totalBytes: number;
    }
  | { kind: "error" };

type SwMessage = {
  type: string;
  installed?: boolean;
  pct?: number;
  done?: number;
  total?: number;
  loadedBytes?: number;
  totalBytes?: number;
  version?: string;
  files?: number;
  bytes?: number;
};

const TEXT = {
  ru: {
    title: "БЛОК БУМ",
    check: "Проверяем игру…",
    load: "Скачиваем игру на устройство",
    hint: "Первый запуск: скачаем все файлы один раз — дальше игра работает без интернета и запускается мгновенно.",
    error: "Не удалось скачать игру. Проверьте интернет и повторите.",
    retry: "Повторить",
    files: "файлов",
    mb: "МБ",
  },
  en: {
    title: "BLOCK BOOM",
    check: "Checking the game…",
    load: "Downloading the game to your device",
    hint: "First launch: all files are downloaded once — then the game works offline and starts instantly.",
    error: "Could not download the game. Check your connection and retry.",
    retry: "Retry",
    files: "files",
    mb: "MB",
  },
} as const;

const fmtMB = (bytes: number): string => (bytes / 1048576).toFixed(2);

export default function BootScreen({ onReady }: { onReady: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [lang, setLang] = useState<Lang>("ru");
  const [attempt, setAttempt] = useState(0);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
    // язык — внешние данные (localStorage): читаем после гидратации,
    // отложенно — как в page.tsx (не ломает гидратацию и не плодит ре-рендеры)
    const id = window.setTimeout(() => setLang(detectLang()), 0);
    return () => window.clearTimeout(id);
  }, [onReady]);

  useEffect(() => {
    let alive = true;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (alive) onReadyRef.current();
    };
    const fail = () => {
      if (alive) setPhase({ kind: "error" });
    };
    const armWatchdog = (ms: number) => {
      if (watchdog) clearTimeout(watchdog);
      // перезапускается каждым bb-progress — следим только за полной тишиной
      watchdog = setTimeout(fail, ms);
    };

    const onSwMessage = (ev: MessageEvent<SwMessage | null>) => {
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "bb-progress") {
        armWatchdog(90_000);
        setPhase({
          kind: "downloading",
          pct: d.pct ?? 0,
          done: d.done ?? 0,
          total: d.total ?? 0,
          loadedBytes: d.loadedBytes ?? 0,
          totalBytes: d.totalBytes ?? 0,
        });
      } else if (d.type === "bb-installed") {
        // дублируем «файл-маркер» в localStorage — удобно для диагностики
        try {
          window.localStorage.setItem(
            "blockboom-installed",
            JSON.stringify({ version: d.version, files: d.files, bytes: d.bytes, at: Date.now() }),
          );
        } catch (_) {}
        finish();
      } else if (d.type === "bb-error") {
        fail();
      }
    };

    // Спросить активный SW: есть ли файл-маркер (таймаут — SW мог быть занят)
    const askMeta = (sw: ServiceWorker): Promise<{ installed?: boolean } | null> =>
      new Promise((resolve) => {
        const timeout = setTimeout(() => {
          navigator.serviceWorker.removeEventListener("message", onReply);
          resolve(null);
        }, 4000);
        const onReply = (ev: MessageEvent<SwMessage | null>) => {
          if (ev.data?.type === "bb-meta-result") {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("message", onReply);
            resolve({ installed: !!ev.data.installed });
          }
        };
        // ответ придёт общим слушателем ниже — временно ставим свой
        navigator.serviceWorker.addEventListener("message", onReply);
        sw.postMessage({ type: "bb-meta" });
      });

    const boot = async () => {
      // dev-режим и браузеры без SW — игра просто стартует (онлайн)
      if (process.env.NODE_ENV !== "production") {
        finish();
        return;
      }
      if (!("serviceWorker" in navigator)) {
        finish();
        return;
      }

      navigator.serviceWorker.addEventListener("message", onSwMessage);

      let reg: ServiceWorkerRegistration | undefined;
      try {
        reg = await navigator.serviceWorker.getRegistration();
      } catch (_) {
        reg = undefined;
      }

      // битая регистрация (упавший install) — сносим и ставим заново
      if (reg && !reg.active) {
        try {
          await reg.unregister();
        } catch (_) {}
        reg = undefined;
      }

      // 1) Повторный запуск: активный SW + файл-маркер → мгновенный старт
      if (reg?.active) {
        const meta = await askMeta(reg.active);
        if (!alive) return;
        if (meta?.installed) {
          finish();
          return;
        }
        // кеш неполный — тихо докачать с прогрессом
        reg.active.postMessage({ type: "bb-repair" });
        armWatchdog(90_000);
        return;
      }

      // 2) Первая установка: ставим SW, ждём полной загрузки
      try {
        reg = await navigator.serviceWorker.register("/sw.js");
      } catch (_) {
        fail();
        return;
      }

      if (reg.active) {
        const meta = await askMeta(reg.active);
        if (!alive) return;
        if (meta?.installed) {
          finish();
          return;
        }
        reg.active.postMessage({ type: "bb-repair" });
        armWatchdog(90_000);
        return;
      }

      const worker = reg.installing || reg.waiting;
      if (worker) {
        worker.addEventListener("statechange", () => {
          if (!alive || !worker) return;
          if (worker.state === "redundant") {
            fail();
          } else if (worker.state === "activated") {
            // активация (claim): маркер уже должен быть
            void askMeta(worker).then((meta) => {
              if (!alive) return;
              if (meta?.installed) finish();
              else if (worker) {
                worker.postMessage({ type: "bb-repair" });
                armWatchdog(90_000);
              }
            });
          }
        });
      }
      armWatchdog(120_000);
    };

    void boot();

    return () => {
      alive = false;
      if (watchdog) clearTimeout(watchdog);
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, [attempt]);

  const t = TEXT[lang];
  const retry = useCallback(() => {
    setPhase({ kind: "checking" });
    setAttempt((a) => a + 1);
  }, []);

  return (
    <div
      className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#0f0d15] text-white select-none"
      aria-label={lang === "ru" ? "Загрузка Блок Бум" : "Loading Block Boom"}
    >
      {/* фон в стиле меню: арт + вуаль + янтарное свечение */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/art/menu-bg.jpg')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#14101f]/80 via-[#120f18]/85 to-[#0d0b12]/95" />
        <div className="absolute inset-x-[-30%] top-[-18%] h-[62%] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.14),transparent_65%)]" />
      </div>

      <main className="relative flex w-full max-w-[420px] flex-col items-center px-8">
        <img
          src="/art/icon.png"
          alt=""
          aria-hidden="true"
          className="size-[104px] rotate-3 rounded-[30px] border-2 border-white/25 shadow-[0_18px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]"
        />
        <h1 className="logo-3d mt-5 text-[38px] font-black leading-none tracking-wide">{t.title}</h1>

        {phase.kind === "checking" && (
          <p className="mt-7 animate-pulse text-sm font-bold text-white/60">{t.check}</p>
        )}

        {phase.kind === "downloading" && (
          <section className="mt-7 w-full" aria-live="polite">
            <div className="flex items-baseline justify-between text-[11px] font-bold text-white/60">
              <span>{t.load}</span>
              <span className="text-sm tabular-nums text-amber-300">{phase.pct}%</span>
            </div>
            <div
              className="mt-2 h-4 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={phase.pct}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-200 shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] transition-[width] duration-150"
                style={{ width: `${Math.max(phase.pct, 4)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] font-semibold tabular-nums text-white/45">
              <span>
                {phase.done} / {phase.total} {t.files}
              </span>
              <span>
                {fmtMB(phase.loadedBytes)} / {fmtMB(phase.totalBytes)} {t.mb}
              </span>
            </div>
            <p className="mt-3 text-center text-[11px] font-medium leading-relaxed text-white/40">{t.hint}</p>
          </section>
        )}

        {phase.kind === "error" && (
          <section className="mt-7 w-full text-center">
            <p className="text-sm font-bold leading-relaxed text-rose-300">{t.error}</p>
            <button
              type="button"
              onClick={retry}
              className="btn-amber mt-5 rounded-xl px-9 py-3 text-base font-black text-white"
            >
              {t.retry}
            </button>
          </section>
        )}

        <footer className="absolute bottom-[max(env(safe-area-inset-bottom),14px)] left-0 right-0 text-center text-[10px] font-bold text-white/25">
          v{APP_VERSION}
        </footer>
      </main>
    </div>
  );
}
