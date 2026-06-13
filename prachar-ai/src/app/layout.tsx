import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prachar.ai — Your AI Creative Director",
  description: "Generate viral Hinglish campaigns, structured marketing strategies, and authentic local copy in seconds. The AI-powered creative director built for Indian creators.",
  keywords: ["AI marketing", "Hinglish campaigns", "Indian Gen-Z", "social media", "creative director", "viral campaigns", "content creator tools"],
  openGraph: {
    title: "Prachar.ai — Your AI Creative Director",
    description: "Generate viral campaigns in seconds with AI. Built for Indian creators.",
    type: "website",
    locale: "en_IN",
    siteName: "Prachar.ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prachar.ai — Your AI Creative Director",
    description: "Generate viral campaigns in seconds with AI. Built for Indian creators.",
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
