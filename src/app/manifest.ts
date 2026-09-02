import type { MetadataRoute } from "next";

// обязательное для output: "export" (статический экспорт в Android-обёртку)
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Block Boom — Blast Block Puzzle",
    short_name: "Block Boom",
    description:
      "50 explosive levels: goals, move limits, ticking bombs, stars, coins and boosters. Play offline with one hand.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141219",
    theme_color: "#141219",
    lang: "en",
    categories: ["games", "puzzle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
