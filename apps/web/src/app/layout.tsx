import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://geocast.games"),
  title: {
    default: "GeoCast — Predict where Earth will quake next.",
    template: "%s · GeoCast",
  },
  description:
    "Un-gameable geo-prediction game. Pin where the first M5+ earthquake will strike after the round closes. Closest to the epicentre wins.",
  applicationName: "GeoCast",
  keywords: [
    "geo prediction",
    "prediction game",
    "geo game",
    "map game",
    "web3 game",
    "GeoCast",
  ],
  authors: [{ name: "Vitalii Kindrakevych", url: "https://github.com/kindrakevich-agency" }],
  creator: "Vitalii Kindrakevych",
  openGraph: {
    type: "website",
    siteName: "GeoCast",
    title: "GeoCast — Predict where Earth will quake next.",
    description: "Un-gameable geo-prediction game. Pin where the first M5+ earthquake will strike after the round closes. Closest to the epicentre wins.",
    url: "https://geocast.games",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoCast — Predict where Earth will quake next.",
    description: "Un-gameable geo-prediction game. Pin where the first M5+ earthquake will strike after the round closes. Closest to the epicentre wins.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
