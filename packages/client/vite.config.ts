// Vite dev/build config for the client: fixed dev-server port, default static build,
// plus a build-time git-SHA stamp for the telemetry stack (src/buildInfo.ts).
import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** Short commit hash at build time; "dev" outside a git checkout (e.g. a clean tarball). */
function gitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  server: { port: 5173 },
  define: { __BUILD_SHA__: JSON.stringify(gitShortSha()) },
});
