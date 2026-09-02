import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Обычная сборка — Vercel подхватит её без дополнительных настроек.
  // BB_EXPORT=1 — статический экспорт в out/ (для Android-обёртки Capacitor):
  //   BB_EXPORT=1 bun run build  →  папка out/ со всей игрой
  ...(process.env.BB_EXPORT ? { output: "export" as const } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
