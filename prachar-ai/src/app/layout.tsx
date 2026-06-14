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
  title: "Prachar.ai — Your AI Creative Director",
  description: "Generate viral global campaigns, structured marketing strategies, and authentic high-converting copy in seconds. The AI-powered creative director built for modern brands.",
  keywords: ["AI marketing", "global campaigns", "digital marketing", "social media", "creative director", "viral campaigns", "content creator tools"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Prachar.ai",
  },
  openGraph: {
    title: "Prachar.ai — Your AI Creative Director",
    description: "Generate viral campaigns in seconds with AI. Built for modern brands.",
    type: "website",
    locale: "en_US",
    siteName: "Prachar.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prachar.ai — Your AI Creative Director",
    description: "Generate viral campaigns in seconds with AI. Built for modern brands.",
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
