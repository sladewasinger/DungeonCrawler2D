/** Centered parchment Overworld Map (toggled with [M] or holding the Map item) showing terrain, POIs, and players. */
import { GroundKind, PropKind, type PlayerSnapshot, type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot } from "@dc2d/engine";

const MAP_PX = 360;
const COLOR_ENEMY = "#ef4444";
const COLOR_PLAYER_REMOTE = "#a855f7";
const COLOR_CHEST = "#facc15";
const COLOR_CAMPFIRE = "#fb923c";

const GROUND_COLORS: Readonly<Record<number, string>> = {
  [GroundKind.DeepWater]: "#1d4ed8",
  [GroundKind.ShallowWater]: "#3b82f6",
  [GroundKind.Sand]: "#d4a359",
  [GroundKind.Grass]: "#3f7d3a",
  [GroundKind.MeadowGrass]: "#539a48",
  [GroundKind.ForestFloor]: "#2d5a2b",
  [GroundKind.DirtPath]: "#8c5b36",
  [GroundKind.CliffStone]: "#64748b",
  [GroundKind.MossStone]: "#47694f",
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
  ctx.moveTo(8, 0); ctx.lineTo(-5, 5.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -5.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-3.8, 3.8); ctx.lineTo(-1.8, 0); ctx.lineTo(-3.8, -3.8);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function paintTilePixel(ctx: CanvasRenderingContext2D, opts: {
  readonly cache: WorldChunkCache; readonly wx: number; readonly wy: number; readonly px: number; readonly py: number; readonly step: number;
}): void {
  const tile = opts.cache.tileAt(opts.wx, opts.wy);
  ctx.fillStyle = GROUND_COLORS[tile.ground] ?? "#3f7d3a";
  ctx.fillRect(opts.px, opts.py, opts.step, opts.step);
  if (tile.elevation > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(opts.px, opts.py, opts.step, opts.step);
  }
}

export class MinimapOverlay {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly terrainBuf: HTMLCanvasElement;
  private readonly zoomBtn: HTMLButtonElement;
  private readonly coordsEl: HTMLSpanElement;
  private zoom = 2;
  private terrainCacheKey = "";

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
      this.zoom = this.zoom >= 3 ? 1 : this.zoom + 1;
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
    readonly chests: readonly WorldChestSnapshot[];
  }): void {
    this.el.hidden = !opts.visible || !opts.local;
    if (this.el.hidden || !opts.local) return;
    const { local } = opts;
    this.coordsEl.textContent = `(${Math.floor(local.x)}, ${Math.floor(local.y)})`;
    this.refreshTerrainLayer(opts.cache, Math.floor(local.x), Math.floor(local.y));
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.terrainBuf, 0, 0);
    this.drawMarkers(ctx, { ...opts, local });
    drawPlayerArrow(ctx, local.facingX, local.facingY);
  }

  private refreshTerrainLayer(cache: WorldChunkCache, tx0: number, ty0: number): void {
    const key = `${cache.worldSeed}:${tx0}:${ty0}:${this.zoom}`;
    if (key === this.terrainCacheKey) return;
    this.terrainCacheKey = key;
    const ctx = this.terrainBuf.getContext("2d");
    if (!ctx) return;
    const step = this.zoom;
    const half = Math.floor(MAP_PX / (2 * step));
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) paintTilePixel(ctx, { cache, wx: tx0 + dx, wy: ty0 + dy, px: (dx + half) * step, py: (dy + half) * step, step });
    }
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
      drawDot(ctx, { px: cx + (prop.x - local.x) * this.zoom, py: cy + (prop.y - local.y) * this.zoom, size: 5, color: COLOR_CAMPFIRE });
    }
    for (const c of opts.chests) {
      drawDot(ctx, { px: cx + (c.x - local.x) * this.zoom, py: cy + (c.y - local.y) * this.zoom, size: 5, color: c.opened ? "#ca8a04" : COLOR_CHEST });
    }
    for (const e of opts.entities.filter((m) => !m.corpse && m.hp > 0)) {
      drawDot(ctx, { px: cx + (e.x - local.x) * this.zoom, py: cy + (e.y - local.y) * this.zoom, size: 4, color: COLOR_ENEMY });
    }
    for (const p of opts.players.filter((pl) => pl.id !== local.id)) {
      drawDot(ctx, { px: cx + (p.x - local.x) * this.zoom, py: cy + (p.y - local.y) * this.zoom, size: 5, color: COLOR_PLAYER_REMOTE });
    }
  }
}
