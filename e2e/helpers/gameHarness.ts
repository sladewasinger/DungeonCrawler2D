/** Playwright E2E test harness: runtime error guards, FPS measurements, WebGL entropy & HUD overlap checks. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { analyzePngEntropy } from "./pngEntropy.js";

export interface RuntimeGuards { readonly assertClean: () => void }
export interface FpsSample { readonly medianFps: number; readonly p95FrameMs: number; readonly samples: number }
interface DiagStatsSnapshot {
  readonly rendererReady: boolean; readonly canvasWidth: number; readonly canvasHeight: number;
  readonly chunkCount: number; readonly playerPos: { readonly x: number; readonly y: number } | null;
  readonly shaderErrors: readonly string[];
}

export function attachRuntimeGuards(page: Page): RuntimeGuards {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`); });
  page.on("response", (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });
  return {
    assertClean: () => { expect(errors, `Unexpected browser runtime errors:\n${errors.join("\n")}`).toEqual([]); },
  };
}

async function assertDiagHealthy(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const api = (window as unknown as { __dc2dDiag?: { getStats(): DiagStatsSnapshot } }).__dc2dDiag;
    const stats = api?.getStats();
    return Boolean(stats?.rendererReady && stats.chunkCount > 0 && stats.playerPos);
  }), { timeout: 10_000 }).toBe(true);
  const stats = await page.evaluate(() =>
    (window as unknown as { __dc2dDiag?: { getStats(): DiagStatsSnapshot } }).__dc2dDiag?.getStats() ?? null);
  expect(stats?.shaderErrors ?? [], "WebGL shader compilation/link errors detected").toEqual([]);
  expect(Number.isFinite(stats?.playerPos?.x) && Number.isFinite(stats?.playerPos?.y), "Non-finite player position").toBe(true);
}

export async function enterOverworld(page: Page, heroName = "GateTester"): Promise<void> {
  await page.goto("/?qaDiag=1", { waitUntil: "domcontentloaded" });
  const backdrop = page.locator(".ow-title-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 15_000 });
  await page.locator(".ow-title-name").fill(heroName);
  await page.locator(".ow-title-enter").click();
  await expect(backdrop).toBeHidden({ timeout: 15_000 });
  const canvas = page.locator("#app canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const box = await canvas.boundingBox();
  expect(box && box.width >= 300 && box.height >= 300, "WebGL canvas failed to size cleanly").toBeTruthy();
  await assertDiagHealthy(page);
}

export async function measureFps(page: Page, durationMs = 1_500): Promise<FpsSample> {
  const deltas = await page.evaluate((ms) => new Promise<number[]>((res) => {
    const out: number[] = [];
    const start = performance.now();
    let prev = start;
    const tick = (now: number) => {
      out.push(now - prev);
      prev = now;
      if (now - start >= ms) { res(out.slice(1)); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), durationMs);
  const sorted = [...deltas].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 33.3;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? med;
  return { medianFps: Math.round((1000 / Math.max(1, med)) * 10) / 10, p95FrameMs: Math.round(p95 * 10) / 10, samples: sorted.length };
}

const HUD_WIDGET_SELECTORS = [".ow-bar", ".ow-zoom-controls", ".ow-vitals", ".ow-hotbar", ".ow-combat-cluster", ".ow-chat-toggle-btn", ".ow-minimap"];

interface HudBox { readonly label: string; readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

function findBoxClipError(b: HudBox, vp: { readonly w: number; readonly h: number }): string | null {
  if (b.left < -2 || b.top < -2 || b.right > vp.w + 2 || b.bottom > vp.h + 2) {
    return `${b.label} clipped outside ${vp.w}x${vp.h}`;
  }
  return null;
}

const boxesIntersect = (a: HudBox, b: HudBox): boolean =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2
  && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;

function findOverlaps(boxes: readonly HudBox[]): string[] {
  const errs: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesIntersect(boxes[i]!, boxes[j]!)) errs.push(`HUD overlap between ${boxes[i]!.label} and ${boxes[j]!.label}`);
    }
  }
  return errs;
}

function validateHudLayout(boxes: readonly HudBox[], vp: { readonly w: number; readonly h: number }): string[] {
  const clipErrs = boxes.map((b) => findBoxClipError(b, vp)).filter((e): e is string => e !== null);
  return [...clipErrs, ...findOverlaps(boxes)];
}

export async function assertNoHudOverlap(page: Page): Promise<void> {
  const data = await page.evaluate((selectors) => {
    const boxes: HudBox[] = [];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el || getComputedStyle(el).display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 2 && r.height >= 2) boxes.push({ label: sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    return { boxes, w: window.innerWidth, h: window.innerHeight };
  }, HUD_WIDGET_SELECTORS);
  const issues = validateHudLayout(data.boxes, { w: data.w, h: data.h });
  expect(issues, `HUD layout issues:\n${issues.join("\n")}`).toEqual([]);
}

interface QaManifest {
  readonly phase: string;
  readonly screenshots: { reqId: string; project: string; file: string; medianFps?: number; entropyPassed: boolean }[];
}

function upsertManifest(manifestPath: string, entry: QaManifest["screenshots"][number], phase: string): void {
  let manifest: QaManifest = { phase, screenshots: [] };
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as QaManifest; } catch { /* first entry */ }
  const next = manifest.screenshots.filter((s) => !(s.reqId === entry.reqId && s.project === entry.project));
  next.push(entry);
  writeFileSync(manifestPath, JSON.stringify({ phase, screenshots: next }, null, 2), "utf8");
}

async function captureIsolatedCanvasBuf(page: Page): Promise<Buffer> {
  await page.evaluate(() => {
    const s = document.createElement("style");
    s.id = "__qa_hide_hud";
    s.textContent = "body * { visibility: hidden !important; } #app canvas { visibility: visible !important; }";
    document.head.appendChild(s);
  });
  try { return await page.locator("#app canvas").first().screenshot(); } finally {
    await page.evaluate(() => document.getElementById("__qa_hide_hud")?.remove());
  }
}

export async function captureQaScreenshot(page: Page, opts: {
  readonly phase: string; readonly project: string; readonly reqId: string; readonly medianFps?: number;
}): Promise<void> {
  const outDir = resolve(process.cwd(), "artifacts/qa", opts.phase);
  mkdirSync(outDir, { recursive: true });
  const file = `${opts.project}-${opts.reqId}.png`;
  await page.screenshot({ path: resolve(outDir, file) });
  const canvasStats = analyzePngEntropy(await captureIsolatedCanvasBuf(page));
  expect(canvasStats.nonBlank, `Blank/corrupt WebGL canvas for ${file} (stdDev=${canvasStats.lumaStdDev.toFixed(2)}, colors=${canvasStats.uniqueColors})`).toBe(true);
  upsertManifest(resolve(outDir, "manifest.json"), {
    reqId: opts.reqId, project: opts.project, file,
    ...(opts.medianFps !== undefined ? { medianFps: opts.medianFps } : {}),
    entropyPassed: canvasStats.nonBlank,
  }, opts.phase);
}
