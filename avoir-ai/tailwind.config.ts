import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        "terminal-bg": "var(--terminal-bg)",
        "terminal-surface": "var(--terminal-surface)",
        "terminal-border": "var(--terminal-border)",
        "terminal-border-bright": "var(--terminal-border-bright)",
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
