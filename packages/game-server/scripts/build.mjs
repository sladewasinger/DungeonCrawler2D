// Bundles the game-server into the single CJS file (dist/main.cjs) the EC2 systemd unit and deploy workflow expect.
import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  packages: "bundle",
  sourcemap: true,
});

console.log("[build] wrote dist/main.cjs");
