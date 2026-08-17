import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "terminal-bg": "#000000",
        "terminal-surface": "#0A0A0A",
        "terminal-border": "#222222",
        "terminal-border-bright": "#333333",
        "neon-amber": "#F59E0B",
        "neon-cyan": "#06B6D4",
        "neon-green": "#22C55E",
        "neon-red": "#EF4444",
        "neon-indigo": "#6366F1",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
