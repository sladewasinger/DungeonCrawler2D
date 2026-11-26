/** Category-colored [M] Overworld Map pins, Waystone '?' beacons, and discovery counter formatting. */
import { getBiomeEntry } from "@dc2d/content";
import {
  TOTAL_POI_TYPES, computeDangerTier, getPoiCatalogEntry, sampleMacroBiome,
  type DiscoveryStateSnapshot, type PoiCategory, type PoiKind, type WorldChunkCache,
} from "@dc2d/engine";

const CATEGORY_PIN: Readonly<Record<PoiCategory, { readonly color: string; readonly shape: "diamond" | "star" | "square" | "cross" | "dot" }>> = {
  shrine: { color: "#38bdf8", shape: "diamond" },
  lair: { color: "#ef4444", shape: "star" },
  puzzle: { color: "#fbbf24", shape: "square" },
  friendly: { color: "#4ade80", shape: "cross" },
  micro: { color: "#2dd4bf", shape: "dot" },
  camp: { color: "#fb923c", shape: "square" },
  ruins: { color: "#94a3b8", shape: "diamond" },
};

const ROMAN: Readonly<Record<number, string>> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

function drawPinGlyph(ctx: CanvasRenderingContext2D, opts: { readonly px: number; readonly py: number; readonly color: string; readonly shape: string }): void {
  const { px, py, color, shape } = opts;
  ctx.save();
  ctx.fillStyle = "#090d14";
  ctx.fillRect(Math.round(px - 4), Math.round(py - 4), 8, 8);
  ctx.fillStyle = color;
  if (shape === "diamond" || shape === "star") {
    ctx.beginPath();
    ctx.moveTo(px, py - 4); ctx.lineTo(px + 4, py); ctx.lineTo(px, py + 4); ctx.lineTo(px - 4, py);
    ctx.closePath(); ctx.fill();
  } else if (shape === "cross") {
    ctx.fillRect(Math.round(px - 1), Math.round(py - 4), 2, 8);
    ctx.fillRect(Math.round(px - 4), Math.round(py - 1), 8, 2);
  } else {
    ctx.fillRect(Math.round(px - 3), Math.round(py - 3), 6, 6);
  }
  ctx.restore();
}

function drawBeaconMarker(ctx: CanvasRenderingContext2D, pos: { readonly px: number; readonly py: number; readonly pulse: number }): void {
  const { px, py, pulse } = pos;
  ctx.save();
  ctx.fillStyle = "#090d14";
  ctx.beginPath(); ctx.arc(px, py, 6 + pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, 5 + pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", px, py + 0.5);
  ctx.restore();
}

function inBounds(px: number, py: number, mapPx: number): boolean {
  return px >= -6 && py >= -6 && px <= mapPx + 6 && py <= mapPx + 6;
}

interface PinDrawParams {
  readonly ctx: CanvasRenderingContext2D; readonly cache: WorldChunkCache;
  readonly localX: number; readonly localY: number; readonly zoom: number; readonly mapPx: number;
  readonly discovered: ReadonlySet<string>;
}

function drawChunkPoiPins(p: PinDrawParams, cx: number, cy: number): void {
  const center = p.mapPx * 0.5;
  for (const poi of p.cache.getChunk(cx, cy).pois) {
    const show = p.discovered.size > 0
      ? p.discovered.has(poi.id)
      : Math.hypot(poi.centerX - p.localX, poi.centerY - p.localY) <= 36;
    if (!show) continue;
    const px = center + (poi.centerX - p.localX) * p.zoom;
    const py = center + (poi.centerY - p.localY) * p.zoom;
    if (inBounds(px, py, p.mapPx)) drawPinGlyph(p.ctx, { px, py, ...CATEGORY_PIN[getPoiCatalogEntry(poi.kind).category] });
  }
}

function drawRevealedBeacons(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly beacons: readonly { readonly x: number; readonly y: number }[];
  readonly localX: number; readonly localY: number; readonly zoom: number; readonly mapPx: number; readonly nowMs: number;
}): void {
  const center = opts.mapPx * 0.5;
  const pulse = Math.sin(opts.nowMs * 0.006) * 1.2;
  for (const b of opts.beacons) {
    const px = center + (b.x - opts.localX) * opts.zoom;
    const py = center + (b.y - opts.localY) * opts.zoom;
    if (inBounds(px, py, opts.mapPx)) drawBeaconMarker(opts.ctx, { px, py, pulse });
  }
}

export function drawFrontierMapPins(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly cache: WorldChunkCache;
  readonly localX: number; readonly localY: number; readonly zoom: number; readonly mapPx: number;
  readonly discovery?: DiscoveryStateSnapshot | undefined; readonly nowMs: number;
}): void {
  const discovered = new Set(opts.discovery?.discoveredPoiIds ?? []);
  const halfChunks = Math.ceil(opts.mapPx / (2 * opts.zoom * 32)) + 1;
  const pcx = Math.floor(opts.localX / 32);
  const pcy = Math.floor(opts.localY / 32);
  const params: PinDrawParams = { ...opts, discovered };
  for (let oy = -halfChunks; oy <= halfChunks; oy++) {
    for (let ox = -halfChunks; ox <= halfChunks; ox++) drawChunkPoiPins(params, pcx + ox, pcy + oy);
  }
  drawRevealedBeacons({ ...opts, beacons: opts.discovery?.revealedBeacons ?? [] });
}

export function formatCompassBiomeHint(worldSeed: number, x: number, y: number): string {
  const biome = sampleMacroBiome(worldSeed, x, y);
  const entry = getBiomeEntry(biome);
  const tier = computeDangerTier(biome, x, y);
  return `${entry.displayName} · T${ROMAN[tier] ?? tier}`;
}

export function formatMapFooterSummary(opts: {
  readonly worldSeed: number;
  readonly x: number;
  readonly y: number;
  readonly discovery?: DiscoveryStateSnapshot | undefined;
}): string {
  const uniqueKinds = new Set<PoiKind>((opts.discovery?.discoveredPoiKinds ?? []) as PoiKind[]);
  const hint = formatCompassBiomeHint(opts.worldSeed, opts.x, opts.y);
  return `${uniqueKinds.size}/${TOTAL_POI_TYPES} Landmarks · ${hint}`;
}
