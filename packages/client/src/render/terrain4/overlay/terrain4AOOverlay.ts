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
    for (const [depth, graphics] of this.layers) {
      const group = grouped.get(depth);
      graphics.clear().setVisible(visible && Boolean(group));
      if (group) drawGroup(graphics, group, projection);
    }
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

function groupByDepth(masks: Terrain4Batches["ao"]): Map<number, Terrain4Batches["ao"]> {
  const grouped = new Map<number, Terrain4AOQuad[]>();
  for (const mask of masks) {
    const depth = depthForCapOccluder(mask.viewTile.y) + 0.06;
    const group = grouped.get(depth) ?? [];
    if (!grouped.has(depth)) grouped.set(depth, group);
    group.push(mask);
  }
  return grouped;
}

function drawGroup(
  graphics: Phaser.GameObjects.Graphics,
  masks: Terrain4Batches["ao"],
  projection: Terrain4ScreenProjection,
): void {
  const alphas = aoBandAlphas(getAOStrength());
  for (const mask of masks) drawMask(graphics, mask.vertices, mask.mask, projection, alphas);
}

function drawMask(
  graphics: Phaser.GameObjects.Graphics,
  vertices: Terrain4QuadVertices,
  mask: Terrain4Batches["ao"][number]["mask"],
  projection: Terrain4ScreenProjection,
  alphas: readonly number[],
): void {
  const points = projectQuad(vertices, projection);
  const sides = ["north", "east", "south", "west"] as const;
  for (let band = 0; band < AO_BAND_FRACS.length; band += 1) {
    graphics.fillStyle(0x06060c, alphas[band] ?? 0);
    const fraction = AO_BAND_FRACS[band] ?? 0;
    for (const side of sides) if (mask[side]) fillQuad(graphics, sideBand(points, side, fraction));
  }
  graphics.fillStyle(0x06060c, aoCornerAlpha(getAOStrength()));
  for (const corner of ["nw", "ne", "sw", "se"] as const) {
    if (mask[corner]) fillQuad(graphics, cornerPatch(points, corner, AO_CORNER_FRAC));
  }
}

function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function sideBand(points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint], side: "north" | "south" | "east" | "west", fraction: number): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  const [tl, tr, br, bl] = points;
  const top = [tl, tr, lerp(tl, bl, fraction), lerp(tr, br, fraction)] as const;
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
  graphics.fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  graphics.fillTriangle(a.x, a.y, c.x, c.y, d.x, d.y);
}
