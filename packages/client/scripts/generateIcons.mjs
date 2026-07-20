#!/usr/bin/env node
// One-off generator for the PWA manifest's icon pair (public/icons/icon-192.png,
// icon-512.png) — composites the same door pieces the title screen's background
// (src/scenes/title/background.ts) draws in-world, straight out of public/assets/atlas.png,
// so the installed-app icon matches the game's own title art instead of a generic
// placeholder. Not part of `npm run build`: icons are committed, pre-rendered output —
// rerun this manually (`node scripts/generateIcons.mjs`) only when the door art changes.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const atlasPath = path.join(clientDir, "public", "assets", "atlas.png");
const outDir = path.join(clientDir, "public", "icons");

// x/y/w/h straight from public/assets/atlas.json's door frames.
const FRAMES = {
  frameLeft: { x: 16, y: 240, w: 16, h: 32 },
  frameRight: { x: 64, y: 240, w: 16, h: 32 },
  frameTop: { x: 32, y: 224, w: 32, h: 16 },
  leafClosed: { x: 32, y: 240, w: 32, h: 32 },
};

const VOID_COLOR = "#14141c";
const GLOW_COLOR = "#ff9e3d";

function buildHtml(atlasDataUrl, size) {
  const scale = size / 64;
  return `<!doctype html><html><body style="margin:0"><canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const img = new Image();
img.onload = () => {
  const ctx = document.getElementById("c").getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "${VOID_COLOR}";
  ctx.fillRect(0, 0, ${size}, ${size});
  const grad = ctx.createRadialGradient(${size / 2}, ${size * 0.42}, 2, ${size / 2}, ${size * 0.42}, ${size * 0.42});
  grad.addColorStop(0, "${GLOW_COLOR}88");
  grad.addColorStop(1, "${GLOW_COLOR}00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ${size}, ${size});
  const draw = (f, dx, dy) => ctx.drawImage(img, f.x, f.y, f.w, f.h, dx * ${scale}, dy * ${scale}, f.w * ${scale}, f.h * ${scale});
  const cx = ${size} / ${scale} / 2;
  draw(${JSON.stringify(FRAMES.leafClosed)}, cx - 16, 16);
  draw(${JSON.stringify(FRAMES.frameLeft)}, cx - 24, 16);
  draw(${JSON.stringify(FRAMES.frameRight)}, cx + 8, 16);
  draw(${JSON.stringify(FRAMES.frameTop)}, cx - 16, 8);
  window.__done = true;
};
img.src = "${atlasDataUrl}";
</script></body></html>`;
}

async function renderIcon(browser, size, outPath) {
  const atlasBase64 = readFileSync(atlasPath).toString("base64");
  const atlasDataUrl = `data:image/png;base64,${atlasBase64}`;
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(buildHtml(atlasDataUrl, size));
  await page.waitForFunction(() => window.__done === true);
  const canvas = page.locator("#c");
  await canvas.screenshot({ path: outPath });
  await page.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    await renderIcon(browser, 192, path.join(outDir, "icon-192.png"));
    await renderIcon(browser, 512, path.join(outDir, "icon-512.png"));
  } finally {
    await browser.close();
  }
  console.log(`icons written to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
