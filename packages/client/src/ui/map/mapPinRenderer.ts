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

const ROMAN: Readonly<Record<number, string>> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };

function traceStarPath(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 4.5 : 1.9;
    const ang = (i * Math.PI) / 4 - Math.PI / 2;
    const x = px + Math.cos(ang) * r;
    const y = py + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPinGlyph(ctx: CanvasRenderingContext2D, opts: { readonly px: number; readonly py: number; readonly color: string; readonly shape: string }): void {
  const { px, py, color, shape } = opts;
  ctx.save();
  ctx.fillStyle = "#090d14";
  ctx.fillRect(Math.round(px - 4), Math.round(py - 4), 8, 8);
  ctx.fillStyle = color;
  if (shape === "diamond") {
    ctx.beginPath();
    ctx.moveTo(px, py - 4); ctx.lineTo(px + 4, py); ctx.lineTo(px, py + 4); ctx.lineTo(px - 4, py);
    ctx.closePath(); ctx.fill();
  } else if (shape === "star") {
    traceStarPath(ctx, px, py);
  } else if (shape === "dot") {
    ctx.beginPath(); ctx.arc(px, py, 2.8, 0, Math.PI * 2); ctx.fill();
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

interface PinEntry {
  readonly cx: number; readonly cy: number;
  readonly x: number; readonly y: number;
  readonly id: string; readonly color: string; readonly shape: string;
}

let cachedPinKey = "";
let cachedPins: PinEntry[] = [];

function getWindowPins(opts: { readonly cache: WorldChunkCache; readonly pcx: number; readonly pcy: number; readonly halfChunks: number }): readonly PinEntry[] {
  const { cache, pcx, pcy, halfChunks } = opts;
  const key = `${cache.worldSeed}:${pcx}:${pcy}:${halfChunks}`;
  if (key === cachedPinKey) return cachedPins;
  cachedPinKey = key;
  const out: PinEntry[] = [];
  for (let oy = -halfChunks; oy <= halfChunks; oy++) {
    for (let ox = -halfChunks; ox <= halfChunks; ox++) {
      for (const poi of cache.getChunk(pcx + ox, pcy + oy).pois) {
        const pin = CATEGORY_PIN[getPoiCatalogEntry(poi.kind).category];
        out.push({ cx: pcx + ox, cy: pcy + oy, x: poi.centerX, y: poi.centerY, id: poi.id, ...pin });
      }
    }
  }
  cachedPins = out;
  return out;
}

function drawWindowPoiPins(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly cache: WorldChunkCache;
  readonly localX: number; readonly localY: number; readonly zoom: number; readonly mapPx: number;
  readonly discovered: ReadonlySet<string>;
}): void {
  const halfChunks = Math.min(8, Math.ceil(opts.mapPx / (2 * opts.zoom * 32)) + 1);
  const pcx = Math.floor(opts.localX / 32);
  const pcy = Math.floor(opts.localY / 32);
  const center = opts.mapPx * 0.5;
  for (const poi of getWindowPins({ cache: opts.cache, pcx, pcy, halfChunks })) {
    if (!opts.discovered.has(poi.id)) continue;
    const px = center + (poi.x - opts.localX) * opts.zoom;
    const py = center + (poi.y - opts.localY) * opts.zoom;
    if (inBounds(px, py, opts.mapPx)) drawPinGlyph(opts.ctx, { px, py, color: poi.color, shape: poi.shape });
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

export function drawMapPins(opts: {
  readonly ctx: CanvasRenderingContext2D; readonly cache: WorldChunkCache;
  readonly localX: number; readonly localY: number; readonly zoom: number; readonly mapPx: number;
  readonly discovery?: DiscoveryStateSnapshot | undefined; readonly nowMs: number;
}): void {
  const discovered = new Set(opts.discovery?.discoveredPoiIds ?? []);
  drawWindowPoiPins({ ...opts, discovered });
  drawRevealedBeacons({ ...opts, beacons: opts.discovery?.revealedBeacons ?? [] });
}

export function formatCompassBiomeHint(worldSeed: number, x: number, y: number): string {
  const biome = sampleMacroBiome(worldSeed, x, y);
  const entry = getBiomeEntry(biome);
  const tier = computeDangerTier(biome, x, y);
  const dist = Math.round(Math.hypot(x, y));
  return `${entry.displayName} · T${ROMAN[tier] ?? tier} · ${dist}m`;
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
