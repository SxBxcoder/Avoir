import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Avoir — The AI Quantitative Engine",
  description: "Execute high-frequency strategies and algorithmic risk modeling in milliseconds. The ultimate AI engine built for institutional capital.",
  keywords: ["AI hedge fund", "quantitative finance", "algorithmic trading", "institutional capital", "alpha generation", "risk modeling"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Avoir",
  },
  openGraph: {
    title: "Avoir — The AI Quantitative Engine",
    description: "Execute high-frequency strategies in milliseconds. Built for institutional capital.",
    type: "website",
    locale: "en_US",
    siteName: "Avoir",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avoir — The AI Quantitative Engine",
    description: "Execute high-frequency strategies in milliseconds. Built for institutional capital.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body
        className={`${inter.variable} antialiased bg-black text-white`}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
