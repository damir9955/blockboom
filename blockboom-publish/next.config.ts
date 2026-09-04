import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Обычная сборка — Vercel подхватит её без дополнительных настроек
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
