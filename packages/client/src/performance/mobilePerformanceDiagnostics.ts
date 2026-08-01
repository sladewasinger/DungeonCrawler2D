import type Phaser from "phaser";
import type { Connection } from "../net/connection/connection.js";
import type { TerrainRendererLike } from "../render/terrain/rendererPort.js";
import type { TerrainDeviceProfile } from "../render/terrain/streaming/terrainDeviceProfile.js";
import { TERRAIN_RUNTIME_TUNING } from "../render/terrain/terrainRuntimeTuning.js";
import type { FrameEntityBuckets } from "../scenes/dungeon/frame/frameEntityBuckets.js";

const MOBILE_PERFORMANCE_QUERY = "mobilePerf";

interface MobilePerformanceSource {
  readonly game: Phaser.Game;
  readonly connection: Connection;
  readonly profile: TerrainDeviceProfile;
  readonly terrain: () => TerrainRendererLike | undefined;
  readonly buckets: () => FrameEntityBuckets;
}

export function createMobilePerformanceDiagnostics(
  source: MobilePerformanceSource,
): MobilePerformanceDiagnostics | undefined {
  return MobilePerformanceDiagnostics.enabled()
    ? new MobilePerformanceDiagnostics(source)
    : undefined;
}

interface MobilePerformanceSample {
  readonly at: string;
  readonly frame: { readonly averageMs: number; readonly p95Ms: number; readonly maxMs: number; readonly over33Ms: number; readonly over50Ms: number };
  readonly canvas: { readonly cssWidth: number; readonly cssHeight: number; readonly backingWidth: number; readonly backingHeight: number; readonly effectiveResolution: number };
  readonly renderer: string;
  readonly device: { readonly profile: string; readonly devicePixelRatio: number; readonly cores: number; readonly memoryGiB?: number };
  readonly network: ReturnType<Connection["networkMetrics"]["snapshot"]>;
  readonly entities: Record<string, number>;
  readonly terrain: { readonly submittedQuads?: number; readonly candidateQuads?: number; readonly constrained: boolean };
  readonly longTasks: number;
}

/** Opt-in local capture for phone investigation; it neither logs nor sends samples. */
export class MobilePerformanceDiagnostics {
  private readonly frameTimes: number[] = [];
  private readonly samples: MobilePerformanceSample[] = [];
  private readonly button: HTMLButtonElement;
  private readonly longTaskObserver: PerformanceObserver | undefined;
  private longTasks = 0;
  private nextSampleMs = 0;

  static enabled(search = window.location.search): boolean {
    return new URLSearchParams(search).get(MOBILE_PERFORMANCE_QUERY) === "1";
  }

  constructor(private readonly source: MobilePerformanceSource) {
    this.button = this.createButton();
    this.longTaskObserver = this.observeLongTasks();
  }

  update(nowMs: number, frameMs: number): void {
    this.recordFrame(frameMs);
    if (nowMs < this.nextSampleMs) return;
    this.nextSampleMs = nowMs + TERRAIN_RUNTIME_TUNING.mobilePerformance.diagnosticSampleSeconds * 1000;
    this.samples.push(this.capture());
    if (this.samples.length > TERRAIN_RUNTIME_TUNING.mobilePerformance.diagnosticMaxSamples) this.samples.shift();
  }

  dispose(): void {
    this.longTaskObserver?.disconnect();
    this.button.remove();
  }

  private recordFrame(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs < 0) return;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 600) this.frameTimes.shift();
  }

  private capture(): MobilePerformanceSample {
    const canvas = this.source.game.canvas;
    const bounds = canvas.getBoundingClientRect();
    const terrain = this.source.terrain();
    return {
      at: new Date().toISOString(),
      frame: summarizeFrames(this.frameTimes),
      canvas: canvasMetrics(canvas, bounds),
      renderer: this.source.game.renderer.type === 2 ? "WebGL" : "Canvas",
      device: deviceMetrics(this.source.profile),
      network: this.source.connection.networkMetrics.snapshot(performance.now()),
      entities: bucketCounts(this.source.buckets()),
      terrain: terrainMetrics(terrain),
      longTasks: this.longTasks,
    };
  }

  private createButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Copy mobile perf";
    button.title = "Copies the last two minutes of local performance samples.";
    button.style.cssText = "position:fixed;right:8px;bottom:8px;z-index:10000;padding:8px;background:#171b2c;color:#f6d65d;border:1px solid #6f7898";
    button.addEventListener("click", () => void this.copy());
    document.body.append(button);
    return button;
  }

  private async copy(): Promise<void> {
    const report = JSON.stringify({ version: 1, samples: this.samples }, null, 2);
    try {
      await navigator.clipboard.writeText(report);
      this.button.textContent = "Copied mobile perf";
    } catch {
      this.button.textContent = "Copy unavailable";
    }
  }

  private observeLongTasks(): PerformanceObserver | undefined {
    if (typeof PerformanceObserver === "undefined") return undefined;
    try {
      const observer = new PerformanceObserver((entries) => { this.longTasks += entries.getEntries().length; });
      observer.observe({ type: "longtask", buffered: true });
      return observer;
    } catch {
      return undefined;
    }
  }
}

function summarizeFrames(frames: readonly number[]) {
  if (frames.length === 0) return { averageMs: 0, p95Ms: 0, maxMs: 0, over33Ms: 0, over50Ms: 0 };
  const sorted = [...frames].sort((left, right) => left - right);
  const total = frames.reduce((sum, frame) => sum + frame, 0);
  return { averageMs: total / frames.length, p95Ms: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0, maxMs: sorted.at(-1) ?? 0, over33Ms: frames.filter((frame) => frame > 33).length, over50Ms: frames.filter((frame) => frame > 50).length };
}

function canvasMetrics(canvas: HTMLCanvasElement, bounds: DOMRect) {
  const cssWidth = Math.round(bounds.width);
  const cssHeight = Math.round(bounds.height);
  return { cssWidth, cssHeight, backingWidth: canvas.width, backingHeight: canvas.height, effectiveResolution: cssWidth > 0 ? canvas.width / cssWidth : 0 };
}

function deviceMetrics(profile: TerrainDeviceProfile) {
  const nav = navigator as Navigator & { readonly deviceMemory?: number };
  return { profile: profile.kind, devicePixelRatio: window.devicePixelRatio || 1, cores: navigator.hardwareConcurrency || 0, ...(nav.deviceMemory === undefined ? {} : { memoryGiB: nav.deviceMemory }) };
}

function bucketCounts(buckets: FrameEntityBuckets): Record<string, number> {
  return { players: buckets.players.length, enemies: buckets.enemies.length, pets: buckets.pets.length, items: buckets.items.length, projectiles: buckets.projectiles.length, torches: buckets.torches.length };
}

function terrainMetrics(terrain: TerrainRendererLike | undefined) {
  return {
    ...(terrain?.submittedTerrainQuadCount === undefined ? {} : { submittedQuads: terrain.submittedTerrainQuadCount }),
    ...(terrain?.candidateTerrainQuadCount === undefined ? {} : { candidateQuads: terrain.candidateTerrainQuadCount }),
    constrained: terrain?.constrainedPresentation === true,
  };
}
