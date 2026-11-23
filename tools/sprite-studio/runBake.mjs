/** One-command CLI (`npm run sprite:bake -- <creature>`) rendering Blender actions & baking spritesheet. */
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

function findProgramFilesBlender() {
  const roots = [process.env.ProgramFiles, process.env["ProgramW6432"]].filter(Boolean);
  for (const root of roots) {
    const found = findBlenderInRoot(root);
    if (found) return found;
  }
  return null;
}

function locateBlenderExecutable() {
  if (process.env.BLENDER_BIN && fs.existsSync(process.env.BLENDER_BIN)) return process.env.BLENDER_BIN;
  const pf = findProgramFilesBlender();
  if (pf) return pf;
  return "blender";
}

function pickBakeOpt(opts, key, fallback) {
  return opts.get(key) ?? fallback;
}

function parseBakeCli(argv) {
  const positional = [];
  const opts = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      opts.set(argv[i].slice(2), argv[++i]);
    } else if (!argv[i].startsWith("--")) {
      positional.push(argv[i]);
    }
  }
  const creature = positional[0];
  if (!creature) throw new Error("Usage: npm run sprite:bake -- <creature> [reviewPath] [--groundY <px>] [--pxPerMeter <n>] [--dirs 4|8]");
  return {
    creature,
    review: pickBakeOpt(opts, "review", positional[1] ?? ""),
    groundY: pickBakeOpt(opts, "groundY", ""),
    pxPerMeter: pickBakeOpt(opts, "pxPerMeter", ""),
    dirs: pickBakeOpt(opts, "dirs", ""),
  };
}

function run() {
  const { creature, review, groundY, pxPerMeter, dirs } = parseBakeCli(process.argv.slice(2));
  const blendPath = path.join(STUDIO_DIR, `${creature}.blend`);
  if (!fs.existsSync(blendPath)) throw new Error(`Missing Blender file: ${blendPath}`);

  const rawDir = path.join(os.tmpdir(), "dc2d-sprite-bake", creature);
  fs.rmSync(rawDir, { recursive: true, force: true });
  fs.mkdirSync(rawDir, { recursive: true });

  const blenderExe = locateBlenderExecutable();
  const exportScript = path.join(STUDIO_DIR, "export_blend.py");
  const blenderArgs = ["--background", blendPath, "--python-exit-code", "1", "--python", exportScript, "--", "--out", rawDir];
  if (pxPerMeter) blenderArgs.push("--pxPerMeter", pxPerMeter);
  if (dirs) blenderArgs.push("--dirs", dirs);
  execFileSync(blenderExe, blenderArgs, { stdio: "inherit" });

  const bakerArgs = [path.join(STUDIO_DIR, "bakeSpriteSheet.mjs"), "--creature", creature, "--rawDir", rawDir];
  if (groundY) bakerArgs.push("--groundY", groundY);
  if (review) bakerArgs.push("--reviewPath", review);
  execFileSync(process.execPath, bakerArgs, { stdio: "inherit" });
}

run();
