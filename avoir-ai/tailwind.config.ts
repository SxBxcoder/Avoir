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
        "terminal-surface": "#0D0D0D",
        "terminal-border": "#2A2A2A",
        "terminal-border-bright": "#3A3A3A",
        "neon-amber": "#F59E0B",
        "neon-cyan": "#22D3EE",
        "neon-green": "#4ADE80",
        "neon-red": "#F87171",
        "neon-indigo": "#818CF8",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
