/* Блок Бум — Service Worker v7: ПОЛНАЯ предзагрузка игры при первой установке.
 *
 * Что делает:
 *   • При первой установке скачивает АБСОЛЮТНО ВСЕ файлы игры (HTML, CSS,
 *     все JS-чанки, иконки, арт) — список берётся из /precache-manifest.json,
 *     который генерируется при сборке (scripts/gen-precache.mjs). Пока
 *     скачивание не завершено — игра не запускается: BootScreen показывает
 *     полоску загрузки, этот SW шлёт ему прогресс (postMessage).
 *   • Когда ВСЁ скачано — создаёт «файл-маркер» /__bb_installed__ (запись в
 *     Cache Storage) с версией игры. Это подтверждение «игра полностью
 *     скачана на устройство».
 *   • При повторном запуске страница спрашивает SW про маркер (bb-meta):
 *     маркер есть → игра открывается мгновенно, без загрузки.
 *   • Обновление: при деплое новой версии браузер замечает новый sw.js,
 *     новый SW скачивает новый кеш В ФОНЕ (игра работает из старого),
 *     активируется ТОЛЬКО при следующем запуске (нет skipWaiting — сессию
 *     не ломаем). Старые версии кеша удаляются при активации.
 *
 * Стратегии ответов:
 *   • Вся статика и навигация — CACHE FIRST (мгновенный офлайн-старт).
 *     Для внутренних страниц (политика конфиденциальности /privacy) отдаётся
 *     их собственный кешированный HTML; неизвестные пути — фолбэк на игру.
 *     Никакой фоновой подмены HTML: версии приложения не смешиваются,
 *     обновление применяется целиком при перезапуске.
 *
 * Никогда не кешируются (всегда напрямую в сеть):
 *   • /api/*, socket.io, /_vercel, рекламные и аналитические эндпоинты;
 *   • WebSocket-соединения (ws/wss) — мимо SW;
 *   • любые не-GET запросы (POST/PUT/DELETE);
 *   • чужие домены (реклама, аналитика, бэкенды);
 *   • Range-запросы (стриминг).
 */

const APP_VERSION = "1.8.6";
const CACHE = "blockboom-v8";

const MANIFEST_URL = "/precache-manifest.json";
// «Файл»: игра полностью скачана (создаётся ПОСЛЕДНИМ, когда всё на месте)
const MARKER_URL = "/__bb_installed__";

// Пути, которые всегда идут напрямую в сеть (API, бэкенд, инфраструктура)
const NEVER_CACHE = [
  /^\/api\//i, // API этого приложения
  /^\/socket\.io\//i, // WebSocket-транспорт (socket.io и т.п.)
  /^\/_vercel\//i, // внутренние роуты Vercel
  /^\/ads?(\/|$)/i, // рекламные эндпоинты
  /\/(analytics|telemetry|metrics|beacon)(\/|$)/i, // аналитика
];
const isNeverCache = (pathname) => NEVER_CACHE.some((re) => re.test(pathname));

// Резервный список (если build-манифест не сгенерировался): разбор HTML
// найдёт чанки, а эти public-файлы известны заранее
const FALLBACK_PUBLIC = [
  "/",
  "/privacy",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/art/icon.png",
  "/art/menu-bg.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

// ── Сообщения странице (прогресс загрузки и т.д.) ──────────────────────────
async function postToClients(msg) {
  try {
    const list = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    for (const c of list) c.postMessage(msg);
  } catch (_) {}
}

// ── Файл-маркер «игра полностью скачана» ───────────────────────────────────
async function readMarker() {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(MARKER_URL);
  if (!hit) return null;
  try {
    return await hit.json();
  } catch (_) {
    return null;
  }
}

async function writeMarker(files, bytes) {
  const cache = await caches.open(CACHE);
  const meta = {
    game: "blockboom",
    version: APP_VERSION,
    cache: CACHE,
    files,
    bytes,
    at: new Date().toISOString(),
  };
  await cache.put(
    MARKER_URL,
    new Response(JSON.stringify(meta), {
      headers: { "content-type": "application/json" },
    }),
  );
  return meta;
}

// ── Список файлов для полной загрузки ──────────────────────────────────────
async function resolveFileList() {
  // 1) Основной путь: манифест, сгенерированный при сборке (все файлы)
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (res && res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.files) && data.files.length > 0) {
        return data.files.map((f) => ({ path: f.path, size: f.size || 0 }));
      }
    }
  } catch (_) {}

  // 2) Резерв: разбор HTML на чанки + скан текста JS/CSS на ассеты
  const urls = new Map();
  const add = (u) => {
    if (typeof u === "string" && u.startsWith("/") && !urls.has(u)) urls.set(u, 0);
  };
  for (const u of FALLBACK_PUBLIC) urls.set(u, 0);
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (res && res.ok) {
      const html = await res.text();
      const re = /(?:src|href)=["'](\/[^"']+\.(?:js|css|png|jpe?g|webp|svg|woff2?))["']/gi;
      let m;
      while ((m = re.exec(html))) add(m[1]);
      // сканируем текст чанков: медиа Next и наши public-ассеты встречаются строками
      const codeUrls = [...urls.keys()].filter((u) => /\.(js|css)$/.test(u));
      const reAsset =
        /(\/_next\/static\/media\/[A-Za-z0-9\-_.%]+?\.(?:png|jpe?g|webp|svg|gif|woff2?))|(\/(?:art|icons|sounds|images)\/[A-Za-z0-9\-_.%]+?\.(?:png|jpe?g|webp|svg|gif|mp3|wav|ogg))/g;
      for (const u of codeUrls) {
        try {
          const r = await fetch(u, { cache: "no-store" });
          if (!r || !r.ok) continue;
          const text = await r.text();
          let a;
          while ((a = reAsset.exec(text))) add(a[1] || a[2]);
        } catch (_) {}
      }
    }
  } catch (_) {}
  return [...urls.entries()].map(([path, size]) => ({ path, size }));
}

// ── Скачивание одного файла в кеш (с ретраями) ─────────────────────────────
async function fetchIntoCache(cache, path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      if (res && res.ok) {
        await cache.put(path, res);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// ── Главная: скачать ВСЁ и создать файл-маркер ─────────────────────────────
async function precacheAll(report) {
  const started = Date.now();
  const cache = await caches.open(CACHE);
  const files = await resolveFileList();
  const total = files.length;
  const totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
  let done = 0;
  let loadedBytes = 0;
  const failed = [];

  const reportProgress = () => {
    if (!report) return;
    postToClients({
      type: "bb-progress",
      done,
      total,
      loadedBytes,
      totalBytes,
      pct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
    });
  };

  // Уже скачанные пропускаем (докачка после сбоя / ремонт)
  const pending = [];
  for (const f of files) {
    const hit = await cache.match(f.path);
    if (hit) {
      done++;
      loadedBytes += f.size || 0;
    } else {
      pending.push(f);
    }
  }
  reportProgress();

  // Качаем пачками по 4 файла: и быстро, и прогресс живой
  const BATCH = 4;
  for (let i = 0; i < pending.length; i += BATCH) {
    const batch = pending.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (f) => {
        const ok = await fetchIntoCache(cache, f.path);
        if (ok) {
          done++;
          loadedBytes += f.size || 0;
        } else {
          failed.push(f.path);
        }
      }),
    );
    reportProgress();
  }

  // Файл-маркер создаётся ПОСЛЕДНИМ — только когда всё скачано
  if (failed.length === 0) {
    const meta = await writeMarker(total, totalBytes);
    if (report) {
      await postToClients({
        type: "bb-installed",
        version: APP_VERSION,
        files: total,
        bytes: totalBytes,
        ms: Date.now() - started,
        meta,
      });
    }
    return meta;
  }

  if (report) {
    await postToClients({ type: "bb-error", failed: failed.length, paths: failed.slice(0, 5) });
  }
  throw new Error("precache incomplete: " + failed.join(", "));
}

// ── Жизненный цикл ─────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  // Полное скачивание в фоне. БЕЗ skipWaiting: новый SW не выйдет на смену,
  // пока игра запущена — обновление применится при следующем запуске.
  event.waitUntil(precacheAll(true));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Удаляем кеши всех старых версий — остаётся только актуальный
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Берём под контроль открытые страницы (только для свежей установки;
      // при обновлении активация и так происходит после закрытия игры)
      await self.clients.claim();
    })(),
  );
});

// ── Ответы на запросы ──────────────────────────────────────────────────────
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

  // Инфраструктура самого SW — всегда свежие из сети
  if (url.pathname === "/sw.js" || url.pathname === MANIFEST_URL || url.pathname === MARKER_URL) return;

  // ── Запуск игры и внутренних страниц (HTML-навигация): мгновенно из кеша ──
  if (req.mode === "navigate") {
    // Нормализуем путь: "/privacy/" → "/privacy"; корень — всегда "/"
    const want = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "") || "/";
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        // Свой HTML для каждой страницы (/, /privacy); неизвестные пути → игра
        const cached = (await cache.match(want, { ignoreSearch: true })) || (await cache.match("/", { ignoreSearch: true }));
        if (cached) return cached; // старт без сети; обновление — только новым SW
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(want, res.clone());
          return res;
        } catch (_) {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // ── Статика (CSS/JS/картинки/шрифты): CACHE FIRST с докэшированием ──
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
      } catch (_) {
        // Оффлайн и промах кеша — честная ошибка сети
        return Response.error();
      }
    })(),
  );
});

// ── Команды от страницы ────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "bb-meta") {
    // «Есть ли файл-маркер и какая версия?» — для мгновенного запуска
    event.waitUntil(
      (async () => {
        const meta = await readMarker();
        const reply = { type: "bb-meta-result", installed: !!meta, meta };
        if (event.source) event.source.postMessage(reply);
        else await postToClients(reply);
      })(),
    );
  } else if (data.type === "bb-repair") {
    // Кеш неполный/битый — перекачать с прогрессом
    event.waitUntil(precacheAll(true));
  }
});
