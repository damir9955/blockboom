import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Block Boom / Блок Бум — Blast Block Puzzle",
  description:
    "40 explosive levels: goals, move limits, ticking bombs, stars, coins and boosters. 40 взрывных уровней: цели, бомбы, звёзды и бустеры. Plays offline in your browser.",
  keywords: [
    "block puzzle",
    "blast game",
    "brain teaser",
    "offline game",
    "головоломка",
    "блоки",
    "пазл",
    "игра без интернета",
  ],
  manifest: "/manifest.webmanifest",
  applicationName: "Block Boom",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Block Boom",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Block Boom / Блок Бум — Blast Block Puzzle",
    description:
      "Level map, stars, boosters and ticking bombs! Мобильная головоломка — играй прямо в браузере, работает офлайн.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141219",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground overscroll-none">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
