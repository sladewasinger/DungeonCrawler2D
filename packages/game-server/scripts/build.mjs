// Bundles the game-server into a single Node ESM file (dist/main.js) for prod deploys.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "bundle",
  sourcemap: true,
});

console.log("[build] wrote dist/main.js");
