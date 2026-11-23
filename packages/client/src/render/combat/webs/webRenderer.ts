/** Dynamic spring-smoothed cloth cobweb renderer and sticky-silk / cocoon player overlays. */
import { TILE_PX, type WorldWebSnapshot } from "@dc2d/engine";
import { Container, Graphics } from "pixi.js";

interface SmoothWebNode {
  x: number;
  y: number;
}

export class WebLayer {
  readonly container = new Container();
  private readonly gfx = new Graphics();
  private readonly smooth = new Map<number, SmoothWebNode>();

  constructor() {
    this.container.addChild(this.gfx);
  }

  sync(webs: WorldWebSnapshot | undefined, dt: number, timeSec: number): void {
    this.gfx.clear();
    if (!webs || webs.strands.length === 0) { this.smooth.clear(); return; }
    const blend = Math.min(1, dt * 16);
    const liveIds = this.syncSmoothNodes(webs, blend);
    this.drawStrands(webs, timeSec);
    for (const id of this.smooth.keys()) if (!liveIds.has(id)) this.smooth.delete(id);
  }

  private syncSmoothNodes(webs: WorldWebSnapshot, blend: number): Set<number> {
    const liveIds = new Set<number>();
    for (const n of webs.nodes) {
      liveIds.add(n.id);
      const cur = this.smooth.get(n.id);
      if (!cur) this.smooth.set(n.id, { x: n.x, y: n.y });
      else { cur.x += (n.x - cur.x) * blend; cur.y += (n.y - cur.y) * blend; }
    }
    return liveIds;
  }

  private drawStrands(webs: WorldWebSnapshot, timeSec: number): void {
    for (const s of webs.strands) {
      const a = this.smooth.get(s.a); const b = this.smooth.get(s.b);
      if (!a || !b) continue;
      const ax = a.x * TILE_PX; const ay = a.y * TILE_PX;
      const bx = b.x * TILE_PX; const by = b.y * TILE_PX;
      const mx = (ax + bx) * 0.5; const my = (ay + by) * 0.5 + 1.8;
      this.drawSingleStrand({ ax, ay, mx, my, bx, by, fire: s.fire ?? 0, timeSec });
    }
  }

  private drawSingleStrand(opts: {
    readonly ax: number; readonly ay: number; readonly mx: number; readonly my: number;
    readonly bx: number; readonly by: number; readonly fire: number; readonly timeSec: number;
  }): void {
    const { ax, ay, mx, my, bx, by, fire, timeSec } = opts;
    this.gfx.moveTo(ax, ay + 1.2).quadraticCurveTo(mx, my + 1.2, bx, by + 1.2).stroke({ color: 0x0f172a, width: 1.8, alpha: 0.28 });
    const burnCol = Math.floor(timeSec * 14) % 2 === 0 ? 0xf97316 : 0xfde047;
    const color = fire > 0 ? burnCol : 0xf1f5f9;
    this.gfx.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ color, width: fire > 0 ? 1.5 : 1.05, alpha: fire > 0 ? 0.92 : 0.78 });
    this.gfx.circle(ax, ay, 0.9).fill({ color: fire > 0 ? 0xfb923c : 0xe2e8f0, alpha: 0.72 });
  }
}

function drawCocoonWrap(g: Graphics, prog: number, timeSec: number): void {
  const rx = 5.5 + prog * 3.8;
  const ry = 8.5 + prog * 7.0;
  const cy = -8 - prog * 3.5;
  g.ellipse(0, cy, rx + 0.8, ry + 0.8).fill({ color: 0x0f172a, alpha: 0.28 * prog });
  g.ellipse(0, cy, rx, ry).fill({ color: 0xe2e8f0, alpha: 0.42 + prog * 0.48 });
  const bands = Math.max(2, Math.round(prog * 6));
  for (let i = 0; i < bands; i++) {
    const y = cy - ry * 0.65 + (i / Math.max(1, bands - 1)) * ry * 1.3;
    const w = rx * (0.85 + Math.sin(i * 1.7 + timeSec * 2) * 0.1);
    g.moveTo(-w, y - 1.5).lineTo(w, y + 1.5).stroke({ color: 0xf8fafc, width: 1.5, alpha: 0.9 });
  }
}

export function drawPlayerWebOverlay(opts: {
  readonly g: Graphics; readonly webStick: number; readonly cocoonProgress: number; readonly timeSec: number;
}): void {
  const { g, webStick, cocoonProgress, timeSec } = opts;
  g.clear();
  if (webStick <= 0.12 && cocoonProgress <= 0) { g.visible = false; return; }
  g.visible = true;
  if (webStick > 0.12) {
    const a = Math.min(0.85, webStick * 0.9);
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 2.2, -1).quadraticCurveTo(i * 1.4, -5, i * 3.2, -8 - (i % 2) * 2).stroke({ color: 0xf1f5f9, width: 1.0, alpha: a });
    }
  }
  if (cocoonProgress > 0) drawCocoonWrap(g, cocoonProgress, timeSec);
}
