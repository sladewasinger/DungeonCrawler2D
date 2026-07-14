import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    // PORT is set by tooling (e.g. preview harnesses); otherwise 5173,
    // falling forward to the next free port (strictPort: false).
    port: Number(process.env.PORT ?? 5173),
    strictPort: false,
  },
}));
