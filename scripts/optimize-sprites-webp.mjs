/** Converts runtime sprite PNGs referenced by manifests to lossless WebP and updates manifest paths. */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { convertPngBufferToLosslessWebp } from "../tools/sprite-studio/pngCodec.mjs";

const PUBLIC_DIR = resolve(process.cwd(), "packages/client/public");
const MANIFEST_PATH = resolve(PUBLIC_DIR, "assets/sprite-manifest.json");
const RIG_META_PATH = resolve(PUBLIC_DIR, "assets/player/player-rig.json");
const PNG_EXT_RE = /\.png$/i;

const toDiskPath = (relUrl) => resolve(PUBLIC_DIR, relUrl.replace(/^\//, ""));
const toWebpUrl = (url) => (PNG_EXT_RE.test(url) ? url.replace(PNG_EXT_RE, ".webp") : url);

function isValidWebp(buf) {
  return buf.length >= 12
    && buf.subarray(0, 4).toString("ascii") === "RIFF"
    && buf.subarray(8, 12).toString("ascii") === "WEBP";
}

function addUrlIfSuffix(url, suffix, out) {
  if (url && url.endsWith(suffix)) out.add(url);
}

function collectManifestUrls(manifest, suffix, out) {
  for (const entry of Object.values(manifest.assets ?? {})) {
    addUrlIfSuffix(entry.path, suffix, out);
    addUrlIfSuffix(entry.animations?.sheetPath, suffix, out);
  }
}

function collectPlayerUrls(rigMeta, suffix, out) {
  for (const layerId of rigMeta.layers ?? []) out.add(`/assets/player/${layerId}${suffix}`);
  addUrlIfSuffix(rigMeta.bowOverlay?.path, suffix, out);
}

function collectExistingPlayerPngs(rigMeta, out) {
  const candidates = new Set();
  collectPlayerUrls(rigMeta, ".png", candidates);
  for (const rel of candidates) {
    if (existsSync(toDiskPath(rel))) out.add(rel);
  }
}

function convertSingleAsset(relUrl) {
  const pngPath = toDiskPath(relUrl);
  if (!existsSync(pngPath)) throw new Error(`Missing source PNG: ${relUrl}`);
  const pngBuf = readFileSync(pngPath);
  const webpBuf = convertPngBufferToLosslessWebp(pngBuf);
  if (!isValidWebp(webpBuf)) throw new Error(`Invalid WebP output for ${relUrl}`);
  writeFileSync(pngPath.replace(PNG_EXT_RE, ".webp"), webpBuf);
  unlinkSync(pngPath);
  return { relUrl, before: pngBuf.length, after: webpBuf.length };
}

function rewriteManifests(manifest, rigMeta) {
  for (const entry of Object.values(manifest.assets ?? {})) {
    if (entry.path) entry.path = toWebpUrl(entry.path);
    if (entry.animations?.sheetPath) entry.animations.sheetPath = toWebpUrl(entry.animations.sheetPath);
  }
  if (rigMeta.bowOverlay?.path) rigMeta.bowOverlay.path = toWebpUrl(rigMeta.bowOverlay.path);
  rigMeta.bakeVersion = Date.now();
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(RIG_META_PATH, `${JSON.stringify(rigMeta, null, 2)}\n`);
}

function verifyRuntimeWebpPaths(manifest, rigMeta) {
  const expected = new Set();
  collectManifestUrls(manifest, ".webp", expected);
  collectPlayerUrls(rigMeta, ".webp", expected);
  for (const rel of expected) {
    if (!existsSync(toDiskPath(rel))) throw new Error(`Missing WebP runtime asset: ${rel}`);
  }
  return expected.size;
}

function printConversionSummary(results, verifiedCount) {
  const beforeTotal = results.reduce((s, r) => s + r.before, 0);
  const afterTotal = results.reduce((s, r) => s + r.after, 0);
  const topSaved = [...results].sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 10);
  for (const item of topSaved) {
    const pct = ((1 - item.after / item.before) * 100).toFixed(1);
    console.log(`${item.relUrl.padEnd(46)} ${(item.before / 1024).toFixed(1).padStart(6)} KB -> ${(item.after / 1024).toFixed(1).padStart(6)} KB (-${pct}%)`);
  }
  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  const totalPct = beforeTotal > 0 ? ((1 - afterTotal / beforeTotal) * 100).toFixed(1) : "0.0";
  console.log(`Converted ${results.length} assets (${verifiedCount} verified WebP): ${mb(beforeTotal)} -> ${mb(afterTotal)} (-${totalPct}%)`);
}

function run() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const rigMeta = JSON.parse(readFileSync(RIG_META_PATH, "utf8"));
  const targets = new Set();
  collectManifestUrls(manifest, ".png", targets);
  collectExistingPlayerPngs(rigMeta, targets);
  const results = [...targets].map(convertSingleAsset);
  rewriteManifests(manifest, rigMeta);
  const verifiedCount = verifyRuntimeWebpPaths(manifest, rigMeta);
  printConversionSummary(results, verifiedCount);
}

run();
