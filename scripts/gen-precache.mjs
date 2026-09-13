#!/usr/bin/env node
/**
 * Блок Бум — генератор precache-manifest.json (запускается ПОСЛЕ next build).
 *
 * Собирает список АБСОЛЮТНО ВСЕХ файлов игры, чтобы Service Worker при первой
 * установке скачал их на устройство целиком (иначе офлайн потом «дырявый»):
 *   • public/**            → /<файл>            (иконки, арт, sw.js — сам sw не входит)
 *   • .next/static/**      → /_next/static/<файл> (JS-чанки, CSS, шрифты, медиа)
 *   • "/"                  → HTML игры (пререндер .next/server/app/index.html)
 *   • "/manifest.webmanifest" → PWA-манифест (роут app/manifest.ts)
 *
 * Итог пишется в public/precache-manifest.json — next start / Vercel отдают его
 * как обычную статику. Файл генерируется сборкой, в git его коммитить не нужно
 * (добавлен в .gitignore).
 *
 * Запуск: node scripts/gen-precache.mjs   (из корня проекта, после `next build`)
 */
import { readdirSync, statSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP = new Set(["sw.js", "precache-manifest.json"]); // не кешируем сам SW и его манифест
const SKIP_EXT = new Set([".map"]); // source maps — не нужны на телефоне

let version = "0.0.0";
try {
  version = JSON.parse(readFileSync("package.json", "utf8")).version || version;
} catch (_) {}

const files = [];
const seen = new Set();
const push = (path, size) => {
  if (!seen.has(path)) {
    seen.add(path);
    files.push({ path, size });
  }
};

function scan(rootDir, urlPrefix) {
  if (!existsSync(rootDir)) return;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        walk(p);
        continue;
      }
      const rel = relative(rootDir, p).split(sep).join("/");
      if (SKIP.has(rel)) continue;
      if (SKIP_EXT.has(rel.slice(rel.lastIndexOf(".")))) continue;
      push(urlPrefix + rel, st.size);
    }
  };
  walk(rootDir);
}

// 1) Публичные файлы (иконки, арт, манифест PWA-иконок и т.д.)
scan("public", "/");

// 2) Чанки сборки Next (JS/CSS/шрифты/медиа) — отдаются с /_next/static/
scan(".next/static", "/_next/static/");

// 3) HTML игры и PWA-манифест
let htmlSize = 0;
try {
  htmlSize = statSync(".next/server/app/index.html").size;
} catch (_) {}
push("/", htmlSize);
push("/manifest.webmanifest", 0);

const totalBytes = files.reduce((s, f) => s + f.size, 0);
const manifest = { game: "blockboom", version, generatedAt: new Date().toISOString(), totalBytes, files };
writeFileSync("public/precache-manifest.json", JSON.stringify(manifest));

console.log(`[gen-precache] v${version}: ${files.length} файлов, ${(totalBytes / 1048576).toFixed(2)} МБ → public/precache-manifest.json`);
