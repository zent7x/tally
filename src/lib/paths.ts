/** Site path helpers — works with Vite `base: './'` (any static host / GitHub Pages). */

export function withBase(path = ""): string {
  const base = import.meta.env.BASE_URL || "./";
  const clean = path.replace(/^\//, "");
  if (!clean) return base;
  return `${base}${clean}`.replace(/([^:]\/)\/+/g, "$1");
}

export function homeHref(): string {
  return withBase("index.html");
}

export function appHref(action?: "import" | "add" | "demo"): string {
  const path = withBase("app.html");
  return action ? `${path}?action=${action}` : path;
}
