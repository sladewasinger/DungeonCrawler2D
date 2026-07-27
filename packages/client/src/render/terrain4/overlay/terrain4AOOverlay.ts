import type Phaser from "phaser";
import { AO_BAND_FRACS, AO_CORNER_FRAC, aoBandAlphas, aoCornerAlpha, getAOStrength } from "../../terrain/contactShade.js";
import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "../phaser4QuadBatch.js";
import type { Terrain4AOQuad, Terrain4Batches, Terrain4QuadVertices } from "../geometry/terrainPlannerModel.js";
import { depthForCapOccluder } from "../../entities/depthSort.js";

/** One Graphics object per depth row keeps AO batched while preserving entity ordering. */
export class Terrain4AOOverlayRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(masks: Terrain4Batches["ao"], projection: Terrain4ScreenProjection, visible: boolean): void {
    const grouped = groupByDepth(masks);
    for (const graphics of this.layers.values()) graphics.clear().setVisible(false);
    for (const [depth, group] of grouped) {
      const graphics = this.layers.get(depth) ?? this.createLayer(depth);
      graphics.clear().setVisible(visible).fillStyle(0x06060c, 1);
      drawGroup(graphics, group, projection);
    }
  }

  setVisible(visible: boolean): void {
    for (const graphics of this.layers.values()) graphics.setVisible(visible);
  }

  destroy(): void {
    for (const graphics of this.layers.values()) graphics.destroy();
    this.layers.clear();
  }

  private createLayer(depth: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setDepth(depth);
    this.layers.set(depth, graphics);
    return graphics;
  }
}

type AOSide = "north" | "east" | "south" | "west";
type AOCorner = "nw" | "ne" | "sw" | "se";
type AOPart =
  | { readonly quad: Terrain4AOQuad; readonly region: AOSide }
  | { readonly quad: Terrain4AOQuad; readonly region: AOCorner };

function groupByDepth(masks: Terrain4Batches["ao"]): Map<number, AOPart[]> {
  const grouped = new Map<number, AOPart[]>();
  const add = (quad: Terrain4AOQuad, region: AOPart["region"]): void => {
    // AO is surface content owned by the low receiver tile. Keep every side
    // and corner at that tile's depth; the raised caster's own cap then sorts
    // naturally in front when projected overlap needs to be occluded.
    const depth = depthForCapOccluder(quad.viewTile.y) + 0.06;
    const group = grouped.get(depth) ?? [];
    if (!grouped.has(depth)) grouped.set(depth, group);
    group.push({ quad, region });
  };
  for (const mask of masks) {
    for (const side of ["north", "east", "south", "west"] as const) {
      if (mask.mask[side]) add(mask, side);
    }
    for (const corner of ["nw", "ne", "sw", "se"] as const) {
      if (mask.mask[corner]) add(mask, corner);
    }
  }
  return grouped;
}

function drawGroup(
  graphics: Phaser.GameObjects.Graphics,
  parts: readonly AOPart[],
  projection: Terrain4ScreenProjection,
): void {
  const alphas = aoBandAlphas(getAOStrength());
  for (const part of parts) drawPart(graphics, part, projection, alphas);
}

function drawPart(
  graphics: Phaser.GameObjects.Graphics,
  part: AOPart,
  projection: Terrain4ScreenProjection,
  alphas: readonly number[],
): void {
  const points = projectQuad(part.quad.vertices, projection);
  if (part.region === "nw" || part.region === "ne" || part.region === "sw" || part.region === "se") {
    graphics.fillStyle(0x06060c, aoCornerAlpha(getAOStrength()));
    fillQuad(graphics, cornerPatch(points, part.region, AO_CORNER_FRAC));
    return;
  }
  for (let band = 0; band < AO_BAND_FRACS.length; band += 1) {
    graphics.fillStyle(0x06060c, alphas[band] ?? 0);
    const fraction = AO_BAND_FRACS[band] ?? 0;
    fillQuad(graphics, sideBand(points, part.region, fraction));
  }
}

function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function sideBand(points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint], side: "north" | "south" | "east" | "west", fraction: number): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  const [tl, tr, br, bl] = points;
  // Keep the polygon perimeter ordered clockwise. A self-crossing north band
  // can rasterize as a blinking half-strip while the camera moves.
  const top = [tl, tr, lerp(tr, br, fraction), lerp(tl, bl, fraction)] as const;
  const bottom = [lerp(tl, bl, 1 - fraction), lerp(tr, br, 1 - fraction), br, bl] as const;
  const left = [tl, lerp(tl, tr, fraction), lerp(bl, br, fraction), bl] as const;
  const right = [lerp(tl, tr, 1 - fraction), tr, br, lerp(bl, br, 1 - fraction)] as const;
  return side === "north" ? top : side === "south" ? bottom : side === "east" ? right : left;
}

function cornerPatch(points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint], corner: "nw" | "ne" | "sw" | "se", fraction: number): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  const [tl, tr, br, bl] = points;
  const at = (u: number, v: number): Terrain4ScreenPoint => lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
  const u0 = corner.includes("w") ? 0 : 1 - fraction;
  const u1 = corner.includes("w") ? fraction : 1;
  const v0 = corner.includes("n") ? 0 : 1 - fraction;
  const v1 = corner.includes("n") ? fraction : 1;
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

function lerp(a: Terrain4ScreenPoint, b: Terrain4ScreenPoint, amount: number): Terrain4ScreenPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function fillQuad(graphics: Phaser.GameObjects.Graphics, points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint]): void {
  const [a, b, c, d] = points;
  // One path avoids a visible diagonal seam where two translucent triangles
  // would otherwise rasterize/alpha-blend independently while the camera
  // scrolls between pixels.
  graphics.beginPath();
  graphics.moveTo(a.x, a.y);
  graphics.lineTo(b.x, b.y);
  graphics.lineTo(c.x, c.y);
  graphics.lineTo(d.x, d.y);
  graphics.closePath();
  graphics.fillPath();
}
