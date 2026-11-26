/** Centered parchment Overworld Map (toggled with [M] or hotbar [M] button) showing terrain, POIs, and players. */
import {
  PropKind, isFogTileRevealed,
  type DiscoveryStateSnapshot, type FogState, type PlayerSnapshot, type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { FogMapOverlay, drawSanctuaryAndStairHints } from "./fogOverlay.js";
import { drawMapPins, formatMapFooterSummary } from "./mapPinRenderer.js";
import { MinimapTileCache } from "./minimapTileCache.js";

const MAP_PX = 480;
const COLOR_ENEMY = "#ef4444";
const COLOR_PLAYER_REMOTE = "#a855f7";
const COLOR_CAMPFIRE = "#fb923c";

function drawDot(ctx: CanvasRenderingContext2D, opts: { readonly px: number; readonly py: number; readonly size: number; readonly color: string }): void {
  const half = opts.size * 0.5;
  if (opts.px < -2 || opts.py < -2 || opts.px > MAP_PX + 2 || opts.py > MAP_PX + 2) return;
  ctx.fillStyle = "#090d14";
  ctx.fillRect(Math.round(opts.px - half - 1), Math.round(opts.py - half - 1), opts.size + 2, opts.size + 2);
  ctx.fillStyle = opts.color;
  ctx.fillRect(Math.round(opts.px - half), Math.round(opts.py - half), opts.size, opts.size);
}

function drawPlayerArrow(ctx: CanvasRenderingContext2D, fx: number, fy: number): void {
  const ang = Math.atan2(fy || 1, fx || 0);
  const cx = MAP_PX * 0.5;
  const cy = MAP_PX * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = "#090d14";
  ctx.beginPath();
  ctx.moveTo(10, 0); ctx.lineTo(-6, 7); ctx.lineTo(-3, 0); ctx.lineTo(-6, -7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(7.5, 0); ctx.lineTo(-4.5, 5); ctx.lineTo(-2.2, 0); ctx.lineTo(-4.5, -5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export class MinimapOverlay {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly terrainBuf: HTMLCanvasElement;
  private readonly fogOverlay = new FogMapOverlay(MAP_PX);
  private readonly tileCache = new MinimapTileCache();
  private readonly zoomBtn: HTMLButtonElement;
  private readonly coordsEl: HTMLSpanElement;
  private zoom = 2;
  private terrainCacheKey = "";
  private lastDrawMs = 0;

  constructor(host: HTMLElement, onClose?: () => void) {
    this.el = document.createElement("div");
    this.el.className = "ow-minimap";
    this.el.hidden = true;
    const head = document.createElement("div");
    head.className = "ow-minimap-head";
    const title = document.createElement("span");
    title.textContent = "OVERWORLD MAP [M]";
    const controls = document.createElement("span");
    controls.className = "ow-minimap-controls";
    this.zoomBtn = this.makeZoomButton();
    controls.append(this.zoomBtn);
    if (onClose) controls.append(this.makeCloseButton(onClose));
    head.append(title, controls);
    this.canvas = document.createElement("canvas");
    this.canvas.width = MAP_PX; this.canvas.height = MAP_PX;
    this.canvas.className = "ow-minimap-canvas";
    this.terrainBuf = document.createElement("canvas");
    this.terrainBuf.width = MAP_PX; this.terrainBuf.height = MAP_PX;
    const foot = document.createElement("div");
    foot.className = "ow-minimap-foot";
    this.coordsEl = document.createElement("span");
    foot.append("N ↑ · E → · S ↓ · W ←", this.coordsEl);
    this.el.append(head, this.canvas, foot);
    host.append(this.el);
  }

  private makeZoomButton(): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ow-pill"; btn.textContent = "2×";
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.zoom = this.zoom >= 4 ? 1 : this.zoom + 1;
      btn.textContent = `${this.zoom}×`;
      this.terrainCacheKey = "";
    });
    return btn;
  }

  private makeCloseButton(onClose: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ow-pill"; btn.textContent = "✕";
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClose(); });
    return btn;
  }

  sync(opts: {
    readonly visible: boolean; readonly cache: WorldChunkCache; readonly local: PlayerSnapshot | undefined;
    readonly players: readonly PlayerSnapshot[]; readonly entities: readonly WorldEntitySnapshot[];
    readonly chests: readonly WorldChestSnapshot[]; readonly discovery?: DiscoveryStateSnapshot | undefined;
    readonly fog?: FogState | undefined; readonly fogVersion?: number | undefined;
  }): void {
    const wasHidden = this.el.hidden;
    const show = opts.visible && Boolean(opts.local);
    this.el.hidden = !show;
    if (!show || !opts.local) { this.lastDrawMs = 0; return; }
    const { local } = opts;
    const nowMs = performance.now();
    const tx0 = Math.floor(local.x); const ty0 = Math.floor(local.y);
    if (!wasHidden && this.skipFrame(opts, { tx0, ty0, nowMs })) return;
    this.lastDrawMs = nowMs;
    const summary = formatMapFooterSummary({ worldSeed: opts.cache.worldSeed, x: local.x, y: local.y, discovery: opts.discovery });
    this.coordsEl.textContent = `${summary} · (${tx0}, ${ty0})`;
    this.refreshTerrainLayer(opts.cache, tx0, ty0);
    const ctx = this.canvas.getContext("2d");
    if (ctx) this.renderMapLayers(ctx, { ...opts, local, tx0, ty0, nowMs });
  }

  private skipFrame(
    opts: { readonly cache: WorldChunkCache; readonly fogVersion?: number | undefined },
    v: { readonly tx0: number; readonly ty0: number; readonly nowMs: number },
  ): boolean {
    const cacheKey = `${opts.cache.worldSeed}:${v.tx0}:${v.ty0}:${this.zoom}:${opts.fogVersion ?? 0}`;
    return cacheKey === this.terrainCacheKey && v.nowMs - this.lastDrawMs < 95;
  }

  private renderMapLayers(ctx: CanvasRenderingContext2D, opts: {
    readonly cache: WorldChunkCache; readonly local: PlayerSnapshot; readonly players: readonly PlayerSnapshot[];
    readonly entities: readonly WorldEntitySnapshot[]; readonly chests: readonly WorldChestSnapshot[];
    readonly discovery?: DiscoveryStateSnapshot | undefined; readonly fog?: FogState | undefined;
    readonly fogVersion?: number | undefined; readonly tx0: number; readonly ty0: number; readonly nowMs: number;
  }): void {
    const { local } = opts;
    ctx.drawImage(this.terrainBuf, 0, 0);
    this.drawWorldLayer(ctx, opts);
    if (opts.fog) this.fogOverlay.draw(ctx, { fog: opts.fog, fogVersion: opts.fogVersion ?? 0, worldSeed: opts.cache.worldSeed, tx0: opts.tx0, ty0: opts.ty0, localX: local.x, localY: local.y, zoom: this.zoom, mapPx: MAP_PX });
    drawSanctuaryAndStairHints({ ctx, localX: local.x, localY: local.y, zoom: this.zoom, mapPx: MAP_PX });
    drawMapPins({ ctx, cache: opts.cache, localX: local.x, localY: local.y, zoom: this.zoom, mapPx: MAP_PX, discovery: opts.discovery, nowMs: opts.nowMs });
    drawHomeBedPin(ctx, { cx: MAP_PX * 0.5, cy: MAP_PX * 0.5, zoom: this.zoom, local });
    drawPlayerArrow(ctx, local.facingX, local.facingY);
  }

  private refreshTerrainLayer(cache: WorldChunkCache, tx0: number, ty0: number): void {
    const key = `${cache.worldSeed}:${tx0}:${ty0}:${this.zoom}`;
    if (key === this.terrainCacheKey) return;
    this.terrainCacheKey = key;
    const ctx = this.terrainBuf.getContext("2d");
    if (!ctx) return;
    this.tileCache.paintViewport({ ctx, cache, tx0, ty0, zoom: this.zoom, mapPx: MAP_PX });
  }

  private drawWorldLayer(ctx: CanvasRenderingContext2D, opts: {
    readonly cache: WorldChunkCache; readonly local: PlayerSnapshot;
    readonly players: readonly PlayerSnapshot[]; readonly entities: readonly WorldEntitySnapshot[];
    readonly chests: readonly WorldChestSnapshot[]; readonly fog?: FogState | undefined;
  }): void {
    const view = { cx: MAP_PX * 0.5, cy: MAP_PX * 0.5, zoom: this.zoom, local: opts.local };
    drawCampfireMarkers(ctx, view, opts.cache);
    drawChestMarkers(ctx, view, opts.chests);
    drawEntityMarkers(ctx, view, { entities: opts.entities, fog: opts.fog });
    drawRemotePlayerMarkers(ctx, view, { players: opts.players, fog: opts.fog });
  }
}

interface MarkerView {
  readonly cx: number; readonly cy: number; readonly zoom: number; readonly local: PlayerSnapshot;
}

function drawHomeBedPin(ctx: CanvasRenderingContext2D, v: MarkerView): void {
  const bed = v.local.respawnBedPos;
  if (!bed) return;
  const px = v.cx + (bed.x - v.local.x) * v.zoom;
  const py = v.cy + (bed.y - v.local.y) * v.zoom;
  if (px < -6 || py < -6 || px > MAP_PX + 6 || py > MAP_PX + 6) return;
  ctx.save();
  ctx.fillStyle = "#090d14";
  ctx.fillRect(Math.round(px - 6), Math.round(py - 5), 12, 10);
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(Math.round(px - 5), Math.round(py - 4), 10, 8);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(Math.round(px - 4), Math.round(py - 2), 8, 5);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(Math.round(px - 4), Math.round(py - 3), 3, 2);
  ctx.restore();
}

function drawCampfireMarkers(ctx: CanvasRenderingContext2D, v: MarkerView, cache: WorldChunkCache): void {
  for (const prop of cache.propsNear(v.local.x, v.local.y)) {
    if (prop.kind !== PropKind.Campfire) continue;
    drawDot(ctx, { px: v.cx + (prop.x - v.local.x) * v.zoom, py: v.cy + (prop.y - v.local.y) * v.zoom, size: 6, color: COLOR_CAMPFIRE });
  }
}

function drawChestMarkers(ctx: CanvasRenderingContext2D, v: MarkerView, chests: readonly WorldChestSnapshot[]): void {
  for (const c of chests) {
    if (!c.opened) continue;
    drawDot(ctx, { px: v.cx + (c.x - v.local.x) * v.zoom, py: v.cy + (c.y - v.local.y) * v.zoom, size: 6, color: "#ca8a04" });
  }
}

function shouldDrawEntityPin(e: WorldEntitySnapshot, local: PlayerSnapshot): boolean {
  if (e.corpse || e.hp <= 0) return false;
  const aggro = e.aiState === "chase" || e.aiState === "flank" || e.aiState === "charge" || e.aiState === "alert";
  return aggro || Math.hypot(e.x - local.x, e.y - local.y) <= 12;
}

function drawEntityMarkers(ctx: CanvasRenderingContext2D, v: MarkerView, opts: { readonly entities: readonly WorldEntitySnapshot[]; readonly fog?: FogState | undefined }): void {
  for (const e of opts.entities) {
    if (opts.fog && !isFogTileRevealed(opts.fog, e.x, e.y)) continue;
    if (shouldDrawEntityPin(e, v.local)) {
      drawDot(ctx, { px: v.cx + (e.x - v.local.x) * v.zoom, py: v.cy + (e.y - v.local.y) * v.zoom, size: 5, color: COLOR_ENEMY });
    }
  }
}

function drawRemotePlayerMarkers(ctx: CanvasRenderingContext2D, v: MarkerView, opts: { readonly players: readonly PlayerSnapshot[]; readonly fog?: FogState | undefined }): void {
  for (const p of opts.players) {
    if (p.id === v.local.id || (p.crouching && !p.attackFlash)) continue;
    if (opts.fog && !isFogTileRevealed(opts.fog, p.x, p.y)) continue;
    drawDot(ctx, { px: v.cx + (p.x - v.local.x) * v.zoom, py: v.cy + (p.y - v.local.y) * v.zoom, size: 6, color: COLOR_PLAYER_REMOTE });
  }
}
