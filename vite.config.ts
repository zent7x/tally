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
  plugins: [react(), tailwindcss()],
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
