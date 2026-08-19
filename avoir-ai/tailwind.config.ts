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
        "grid-color": "var(--grid-color)",
        
        // Semantic Dynamic Colors
        success: "rgb(var(--color-success) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        cyan: "rgb(var(--color-cyan) / <alpha-value>)",

        // Legacy Neon (Keep for fallback)
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
