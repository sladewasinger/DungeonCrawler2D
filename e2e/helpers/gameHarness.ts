/** Playwright E2E test harness: runtime error guards, FPS measurements, and visual QA captures. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { analyzePngEntropy } from "./pngEntropy.js";

export interface RuntimeGuards {
  readonly assertClean: () => void;
}

export interface FpsSample {
  readonly medianFps: number;
  readonly p95FrameMs: number;
  readonly samples: number;
}

export function attachRuntimeGuards(page: Page): RuntimeGuards {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`);
  });
  return {
    assertClean: () => {
      expect(errors, `Unexpected browser runtime errors:\n${errors.join("\n")}`).toEqual([]);
    },
  };
}

export async function enterOverworld(page: Page, heroName = "GateTester"): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const backdrop = page.locator(".ow-title-backdrop");
  await expect(backdrop).toBeVisible({ timeout: 15_000 });
  await page.locator(".ow-title-name").fill(heroName);
  await page.locator(".ow-title-enter").click();
  await expect(backdrop).toBeHidden({ timeout: 15_000 });
  const canvas = page.locator("#app canvas").first();
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const box = await canvas.boundingBox();
  expect(box && box.width >= 300 && box.height >= 300, "WebGL canvas failed to size cleanly").toBeTruthy();
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

export async function captureQaScreenshot(page: Page, opts: {
  readonly phase: string; readonly project: string; readonly reqId: string; readonly medianFps?: number;
}): Promise<void> {
  const outDir = resolve(process.cwd(), "artifacts/qa", opts.phase);
  mkdirSync(outDir, { recursive: true });
  const file = `${opts.project}-${opts.reqId}.png`;
  const buf = await page.screenshot({ path: resolve(outDir, file) });
  const stats = analyzePngEntropy(buf);
  expect(stats.nonBlank, `Blank/corrupt canvas capture for ${file} (stdDev=${stats.lumaStdDev.toFixed(2)}, colors=${stats.uniqueColors})`).toBe(true);
  upsertManifest(resolve(outDir, "manifest.json"), {
    reqId: opts.reqId, project: opts.project, file,
    ...(opts.medianFps !== undefined ? { medianFps: opts.medianFps } : {}),
    entropyPassed: stats.nonBlank,
  }, opts.phase);
}
