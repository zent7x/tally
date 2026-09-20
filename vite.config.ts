import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const srcDir = path.join(root, "src");

// Relative base → upload `dist/` to any host or GitHub Pages subpath.
const base = process.env.VITE_BASE || "./";

export default defineConfig({
  root,
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "tally-local-only",
      apply: "build",
      transformIndexHtml(html) {
        const policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'";
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  ],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(recharts|recharts-scale|d3-[^/]+|victory-vendor|react-smooth)\//.test(id)) return "charts";
        },
      },
      input: {
        main: path.join(root, "index.html"),
        app: path.join(root, "app.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [root],
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
});
