import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Block Boom — Blast Block Puzzle",
    short_name: "Block Boom",
    description:
      "40 explosive levels: goals, move limits, ticking bombs, stars, coins and boosters. Play offline with one hand.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#141219",
    theme_color: "#141219",
    lang: "en",
    categories: ["games", "puzzle"],
    // «any maskable» — два purpose через пробел по спеке W3C Web App Manifest
    // (одна иконка годится и для обычного показа, и под маску Android);
    // тип Next про комбинированное значение просто не знает — потому cast
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ] as MetadataRoute.Manifest["icons"],
  };
}
