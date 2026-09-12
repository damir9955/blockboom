"use client";

import { useEffect } from "react";

/**
 * Регистрация Service Worker (только прод-сборка — чтобы не мешать dev-серверу).
 *
 * Поведение:
 *  • Первый заход: SW ставится, вся статика кешируется → игра офлайн
 *    и запускается мгновенно из кеша.
 *  • Обновления: браузер проверяет sw.js при каждом запуске; дополнительно
 *    проверяем при возврате на вкладку и раз в 6 часов (reg.update()).
 *    Новый SW скачивает новый кеш в фоне и активируется только при
 *    СЛЕДУЮЩЕМ перезапуске игры — текущая сессия не прерывается.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // тихая фоновая проверка обновления прямо при старте
          reg.update().catch(() => {});
        })
        .catch(() => {
          // офлайн не критичен — молча живём без него
        });
    };

    const checkUpdate = () => {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update().catch(() => {}));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") checkUpdate();
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    // Возврат на вкладку / каждые 6 часов — качаем обновление в фоне
    document.addEventListener("visibilitychange", onVisible);
    timer = setInterval(checkUpdate, 6 * 60 * 60 * 1000);

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearInterval(timer);
    };
  }, []);
  return null;
}
