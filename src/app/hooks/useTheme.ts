import { useEffect, useSyncExternalStore } from "react";
import type { Theme } from "@/lib/finance/types";
import { STORAGE_KEY } from "@/lib/finance/types";

let fallbackTheme: Theme = "light";
const THEME_EVENT = "tally-theme-change";
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}.theme`);
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* Keep theme changes usable when storage is unavailable. */ }
  return fallbackTheme;
}
function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#101b18" : "#f5f4ee");
  }, [theme]);
  const toggleTheme = () => {
    fallbackTheme = readTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem(`${STORAGE_KEY}.theme`, fallbackTheme); } catch { /* use memory */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return { theme, toggleTheme };
}
