/* Блок Бум — Service Worker: офлайн-игра, мгновенный запуск, фоновые обновления.
 *
 * Стратегии:
 *   • Вся статика (HTML, CSS, JS-чанки, картинки, звуки, шрифты) —
 *     CACHE FIRST: ответ мгновенно из кеша; при промахе — сеть с докэшированием.
 *   • Навигация (запуск игры) — CACHE FIRST (мгновенный старт из кеша) +
 *     тихое обновление HTML в фоне (stale-while-revalidate).
 *
 * Исключения (никогда не кешируются, всегда напрямую в сеть):
 *   • запросы к API/бэкенду (/api/*, рекламные и аналитические эндпоинты);
 *   • WebSocket-соединения (ws/wss, socket.io) — мимо service worker;
 *   • любые не-GET запросы (POST/PUT/DELETE к серверу);
 *   • чужие домены (реклама Yandex Ads, аналитика, инфраструктура Vercel);
 *   • Range-запросы (стриминг) — кешу не поддаются.
 *
 * Версионирование кеша:
 *   • Кеш именуется версией (CACHE ниже). При деплое нового sw.js браузер
 *     скачивает его в фоне; новый SW скачивает НОВЫЙ кеш (состояние
 *     installing/waiting) и НЕ вытесняет старый, пока игра запущена
 *     (нет skipWaiting — текущая сессия не ломается).
 *   • Когда игрок закрывает и запускает игру заново — новый SW активируется,
 *     старые версии кеша удаляются, приложение обслуживается из нового кеша.
 *   • Итог: обновление скачивается в фоне и применяется при следующем
 *     перезапуске игры.
 */

const VERSION = "6";
const CACHE = `blockboom-v${VERSION}`;

const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/apple-touch-icon.png",
  "/art/icon.png",
  "/art/menu-bg.jpg",
];

// Пути, которые всегда идут напрямую в сеть (API, бэкенд, инфраструктура)
const NEVER_CACHE = [
  /^\/api\//i, // API этого приложения
  /^\/socket\.io\//i, // WebSocket-транспорт (socket.io и т.п.)
  /^\/_vercel\//i, // внутренние роуты Vercel
  /^\/ads?(\/|$)/i, // рекламные эндпоинты
  /\/(analytics|telemetry|metrics|beacon)(\/|$)/i, // аналитика
];

const isNeverCache = (pathname) => NEVER_CACHE.some((re) => re.test(pathname));

self.addEventListener("install", (event) => {
  // Фоновое скачивание нового кеша. БЕЗ self.skipWaiting():
  // активация — только при следующем перезапуске приложения.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u)))),
  );
});

self.addEventListener("activate", (event) => {
  // Удаляем кеши всех старых версий (v1…v5) — остаётся только актуальный.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Не-GET (POST к API и т.п.) — всегда мимо кеша
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // WebSocket-апгрейды — service worker их не обслуживает, всегда сеть
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // Чужие домены (бэкенды, реклама, аналитика, Vercel) — всегда сеть
  if (url.origin !== self.location.origin) return;

  // API/бэкенд/инфраструктура — всегда напрямую в сеть, без кеша
  if (isNeverCache(url.pathname)) return;

  // Range-запросы (частичное аудио/видео) не кешируются
  if (req.headers.has("range")) return;

  // ── Запуск игры (HTML-навигация): мгновенно из кеша + обновление в фоне ──
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match("/");
        if (cached) {
          // Мгновенный ответ игроку; свежий HTML тихо подкачиваем в фонe
          event.waitUntil(
            fetch(req)
              .then((res) => {
                if (res && res.ok) cache.put("/", res.clone());
              })
              .catch(() => {}),
          );
          return cached;
        }
        // Холодный старт (первый визит): сеть и сразу в кеш
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put("/", res.clone());
          return res;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // ── Статика (CSS/JS/картинки/звуки/шрифты): CACHE FIRST с докэшированием ──
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        // Кешируем только успешные полные ответы
        if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      } catch (err) {
        // Оффлайн и промах кеша — честная ошибка сети
        return Response.error();
      }
    })(),
  );
});
