import { useEffect, useState } from "react";
import type { Theme } from "@/lib/finance/types";
import { STORAGE_KEY } from "@/lib/finance/types";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}.theme`);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(`${STORAGE_KEY}.theme`, theme);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0d0f11" : "#f7f7f3");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
