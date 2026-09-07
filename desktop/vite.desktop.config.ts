import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Standalone (router-free) SPA build used by the Electron desktop wrapper.
// base: "./" is REQUIRED so assets resolve under the file:// protocol.
export default defineConfig({
  root: __dirname,
  base: "./",
  publicDir: path.resolve(__dirname, "../public"),
  plugins: [react(), tailwindcss(), tsconfigPaths({ root: path.resolve(__dirname, "..") })],
  resolve: {
    alias: { "@": path.resolve(__dirname, "../src") },
  },
  build: {
    outDir: path.resolve(__dirname, "../desktop-dist"),
    emptyOutDir: true,
  },
});
