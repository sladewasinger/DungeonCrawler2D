/** One-command CLI (`npm run player:bake`) exporting player.blend layers & baking sheets + player-rig.json. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STUDIO_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

function findBlenderInRoot(root) {
  const bf = path.join(root, "Blender Foundation");
  if (!fs.existsSync(bf)) return null;
  const versions = fs.readdirSync(bf).sort().reverse();
  const match = versions.map((v) => path.join(bf, v, "blender.exe")).find((p) => fs.existsSync(p));
  return match ?? null;
}

function locateBlenderExecutable() {
  if (process.env.BLENDER_BIN && fs.existsSync(process.env.BLENDER_BIN)) return process.env.BLENDER_BIN;
  const roots = [process.env.ProgramFiles, process.env["ProgramW6432"]].filter(Boolean);
  for (const root of roots) {
    const found = findBlenderInRoot(root);
    if (found) return found;
  }
  return "blender";
}

function applyKvArg(opts, arg) {
  const eq = arg.indexOf("=");
  const key = arg.slice(0, eq);
  const val = arg.slice(eq + 1);
  if (key === "blend" || key === "--blend") opts.blend = val;
  else if (key === "layers" || key === "--layers") opts.layers.push(...val.split(/[+,]/));
}

function applyTokenArg(opts, arg) {
  if (arg === "--sockets-only" || arg === "sockets-only") opts.socketsOnly = true;
  else if (arg.endsWith(".blend")) opts.blend = arg;
  else if (arg.includes("=")) applyKvArg(opts, arg);
  else opts.layers.push(...arg.split(/[+,]/));
}

function parseCliOpts(argv) {
  const opts = { blend: "player.blend", layers: [], socketsOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--blend" || arg === "--layers") && i + 1 < argv.length) {
      applyKvArg(opts, `${arg}=${argv[++i]}`);
    } else {
      applyTokenArg(opts, arg);
    }
  }
  return { blend: opts.blend, layers: opts.layers.filter(Boolean).join(","), socketsOnly: opts.socketsOnly };
}

function buildBlenderArgs({ blendPath, rawDir, layers, socketsOnly }) {
  const args = [
    "--background", blendPath, "--python-exit-code", "1",
    "--python", path.join(STUDIO_DIR, "export_player_layers.py"), "--", "--out", rawDir,
  ];
  if (layers) args.push("--layers", layers);
  if (socketsOnly) args.push("--sockets-only");
  return args;
}

function shouldRunBaker(rawDir, socketsOnly) {
  return !socketsOnly || fs.existsSync(path.join(rawDir, "body-male", "idle_south_f1.png"));
}

function run() {
  const { layers, blend, socketsOnly } = parseCliOpts(process.argv.slice(2));
  const blendPath = path.isAbsolute(blend) ? blend : path.join(STUDIO_DIR, blend);
  if (!fs.existsSync(blendPath)) throw new Error(`Missing Blender file: ${blendPath}`);

  const rawDir = path.join(os.tmpdir(), "dc2d-player-bake");
  if (!layers && !socketsOnly) fs.rmSync(rawDir, { recursive: true, force: true });
  fs.mkdirSync(rawDir, { recursive: true });

  execFileSync(locateBlenderExecutable(), buildBlenderArgs({ blendPath, rawDir, layers, socketsOnly }), { stdio: "inherit" });

  const bakerArgs = [path.join(STUDIO_DIR, "bakePlayerAssets.mjs"), rawDir];
  if (layers) bakerArgs.push("--layers", layers);
  if (shouldRunBaker(rawDir, socketsOnly)) execFileSync(process.execPath, bakerArgs, { stdio: "inherit" });
  console.log("\nDone! Refresh your browser (F5) to load the updated 3D hero sprites.");
}

run();
