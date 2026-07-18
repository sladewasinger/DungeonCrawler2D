// Vite dev/build config for the client: fixed dev-server port, default static build.
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5173 },
});
