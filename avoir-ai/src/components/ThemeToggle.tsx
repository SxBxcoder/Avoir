"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="terminal-btn-outline flex items-center justify-center h-8 w-8 !p-0 ml-4 group"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 hidden dark:block group-hover:text-amber-300 transition-colors" />
      <Moon className="h-4 w-4 block dark:hidden group-hover:text-amber-500 transition-colors" />
    </button>
  );
}
