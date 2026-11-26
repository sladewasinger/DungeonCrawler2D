/** Centered parchment Overworld Map (toggled with [M] or hotbar [M] button) showing terrain, POIs, and players. */
import {
  GroundKind, PropKind, type DiscoveryStateSnapshot, type PlayerSnapshot, type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { drawFrontierMapPins, formatMapFooterSummary } from "./mapPinRenderer.js";

const MAP_PX = 480;
const COLOR_ENEMY = "#ef4444";
const COLOR_PLAYER_REMOTE = "#a855f7";
const COLOR_CHEST = "#facc15";
const COLOR_CAMPFIRE = "#fb923c";

const DEFAULT_RGB: readonly [number, number, number] = [63, 125, 58];
const GROUND_RGB: Readonly<Record<number, readonly [number, number, number]>> = {
  [GroundKind.DeepWater]: [29, 78, 216],
  [GroundKind.ShallowWater]: [59, 130, 246],
  [GroundKind.Sand]: [212, 163, 89],
  [GroundKind.Grass]: [63, 125, 58],
  [GroundKind.MeadowGrass]: [83, 154, 72],
  [GroundKind.ForestFloor]: [45, 90, 43],
  [GroundKind.DirtPath]: [140, 91, 54],
  [GroundKind.CliffStone]: [100, 116, 139],
  [GroundKind.MossStone]: [71, 105, 79],
  [GroundKind.AutumnGrass]: [140, 148, 62],
  [GroundKind.AutumnFloor]: [140, 74, 39],
  [GroundKind.BogMud]: [71, 59, 50],
  [GroundKind.BogMoss]: [55, 104, 80],
  [GroundKind.SlateRock]: [87, 96, 107],
  [GroundKind.AshGround]: [112, 107, 104],
  [GroundKind.RuinFlagstone]: [71, 70, 87],
  [GroundKind.CursedMoss]: [58, 46, 84],
};

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

function fillTerrainBlock(data: Uint8ClampedArray, opts: {
  readonly rgb: readonly [number, number, number]; readonly lift: number;
  readonly px: number; readonly py: number; readonly step: number;
}): void {
  const r = Math.min(255, opts.rgb[0] + opts.lift);
  const g = Math.min(255, opts.rgb[1] + opts.lift);
  const b = Math.min(255, opts.rgb[2] + opts.lift);
  const y0 = Math.max(0, opts.py);
  const y1 = Math.min(MAP_PX, opts.py + opts.step);
  const x0 = Math.max(0, opts.px);
  const x1 = Math.min(MAP_PX, opts.px + opts.step);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const off = (py * MAP_PX + px) * 4;
      data[off] = r; data[off + 1] = g; data[off + 2] = b; data[off + 3] = 255;
    }
  }
}

function paintTileBlock(data: Uint8ClampedArray, opts: {
  readonly cache: WorldChunkCache; readonly wx: number; readonly wy: number; readonly px: number; readonly py: number; readonly step: number;
}): void {
  const tile = opts.cache.tileAt(opts.wx, opts.wy);
  const rgb = GROUND_RGB[tile.ground] ?? DEFAULT_RGB;
  const lift = tile.elevation > 0 ? Math.min(48, tile.elevation * 22) : 0;
  fillTerrainBlock(data, { rgb, lift, px: opts.px, py: opts.py, step: opts.step });
}

export class MinimapOverlay {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly terrainBuf: HTMLCanvasElement;
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
      this.zoom = this.zoom >= 4 ? 2 : this.zoom + 1;
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
  }): void {
    const wasHidden = this.el.hidden;
    this.el.hidden = !opts.visible || !opts.local;
    if (this.el.hidden || !opts.local) { this.lastDrawMs = 0; return; }
    const { local } = opts;
    const nowMs = performance.now();
    const tx0 = Math.floor(local.x); const ty0 = Math.floor(local.y);
    const cacheKey = `${opts.cache.worldSeed}:${tx0}:${ty0}:${this.zoom}`;
    if (!wasHidden && cacheKey === this.terrainCacheKey && nowMs - this.lastDrawMs < 95) return;
    this.lastDrawMs = nowMs;
    const summary = formatMapFooterSummary({ worldSeed: opts.cache.worldSeed, x: local.x, y: local.y, discovery: opts.discovery });
    this.coordsEl.textContent = `${summary} · (${tx0}, ${ty0})`;
    this.refreshTerrainLayer(opts.cache, tx0, ty0);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.terrainBuf, 0, 0);
    drawFrontierMapPins({ ctx, cache: opts.cache, localX: local.x, localY: local.y, zoom: this.zoom, mapPx: MAP_PX, discovery: opts.discovery, nowMs });
    this.drawMarkers(ctx, { ...opts, local });
    drawPlayerArrow(ctx, local.facingX, local.facingY);
  }

  private refreshTerrainLayer(cache: WorldChunkCache, tx0: number, ty0: number): void {
    const key = `${cache.worldSeed}:${tx0}:${ty0}:${this.zoom}`;
    if (key === this.terrainCacheKey) return;
    this.terrainCacheKey = key;
    const ctx = this.terrainBuf.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(MAP_PX, MAP_PX);
    const step = this.zoom;
    const half = Math.floor(MAP_PX / (2 * step));
    for (let dy = -half; dy < half; dy++) {
      for (let dx = -half; dx < half; dx++) {
        paintTileBlock(img.data, { cache, wx: tx0 + dx, wy: ty0 + dy, px: (dx + half) * step, py: (dy + half) * step, step });
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawMarkers(ctx: CanvasRenderingContext2D, opts: {
    readonly cache: WorldChunkCache; readonly local: PlayerSnapshot;
    readonly players: readonly PlayerSnapshot[]; readonly entities: readonly WorldEntitySnapshot[];
    readonly chests: readonly WorldChestSnapshot[];
  }): void {
    const { local } = opts;
    const cx = MAP_PX * 0.5;
    const cy = MAP_PX * 0.5;
    for (const prop of opts.cache.propsNear(local.x, local.y).filter((p) => p.kind === PropKind.Campfire)) {
      drawDot(ctx, { px: cx + (prop.x - local.x) * this.zoom, py: cy + (prop.y - local.y) * this.zoom, size: 6, color: COLOR_CAMPFIRE });
    }
    for (const c of opts.chests) {
      drawDot(ctx, { px: cx + (c.x - local.x) * this.zoom, py: cy + (c.y - local.y) * this.zoom, size: 6, color: c.opened ? "#ca8a04" : COLOR_CHEST });
    }
    for (const e of opts.entities.filter((m) => !m.corpse && m.hp > 0)) {
      drawDot(ctx, { px: cx + (e.x - local.x) * this.zoom, py: cy + (e.y - local.y) * this.zoom, size: 5, color: COLOR_ENEMY });
    }
    for (const p of opts.players.filter((pl) => pl.id !== local.id)) {
      drawDot(ctx, { px: cx + (p.x - local.x) * this.zoom, py: cy + (p.y - local.y) * this.zoom, size: 6, color: COLOR_PLAYER_REMOTE });
    }
  }
}
