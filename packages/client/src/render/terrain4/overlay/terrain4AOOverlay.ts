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
  for (const mask of masks) appendMaskParts(grouped, mask);
  return grouped;
}

function appendMaskParts(grouped: Map<number, AOPart[]>, quad: Terrain4AOQuad): void {
  appendRegions(grouped, quad, ["north", "east", "south", "west"]);
  appendRegions(grouped, quad, ["nw", "ne", "sw", "se"]);
}

function appendRegions(grouped: Map<number, AOPart[]>, quad: Terrain4AOQuad, regions: readonly AOPart["region"][]): void {
  for (const region of regions) if (quad.mask[region]) appendPart(grouped, quad, region);
}

function appendPart(grouped: Map<number, AOPart[]>, quad: Terrain4AOQuad, region: AOPart["region"]): void {
  const depth = depthForCapOccluder(quad.viewTile.y) + 0.06;
  const group = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, group);
  group.push({ quad, region });
}

function drawGroup(
  graphics: Phaser.GameObjects.Graphics,
  parts: readonly AOPart[],
  projection: Terrain4ScreenProjection,
): void {
  const alphas = aoBandAlphas(getAOStrength());
  for (const part of parts) drawPart({ graphics, part, projection, alphas });
}

interface DrawPartInput { readonly graphics: Phaser.GameObjects.Graphics; readonly part: AOPart; readonly projection: Terrain4ScreenProjection; readonly alphas: readonly number[]; }

function drawPart(input: DrawPartInput): void {
  const points = projectQuad(input.part.quad.vertices, input.projection);
  if (isCorner(input.part.region)) return drawCorner(input.graphics, points, input.part.region);
  drawSideBands({ graphics: input.graphics, points, side: input.part.region, alphas: input.alphas });
}

function isCorner(region: AOPart["region"]): region is AOCorner { return region.length === 2; }

function drawCorner(graphics: Phaser.GameObjects.Graphics, points: Terrain4Points, corner: AOCorner): void {
  graphics.fillStyle(0x06060c, aoCornerAlpha(getAOStrength()));
  fillQuad(graphics, cornerPatch(points, corner, AO_CORNER_FRAC));
}

function drawSideBands(input: DrawSideBandsInput): void {
  for (let band = 0; band < AO_BAND_FRACS.length; band += 1) {
    input.graphics.fillStyle(0x06060c, input.alphas[band] ?? 0);
    const fraction = AO_BAND_FRACS[band] ?? 0;
    fillQuad(input.graphics, sideBand(input.points, input.side, fraction));
  }
}

interface DrawSideBandsInput { readonly graphics: Phaser.GameObjects.Graphics; readonly points: Terrain4Points; readonly side: AOSide; readonly alphas: readonly number[]; }

type Terrain4Points = readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint];

function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): Terrain4Points {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function sideBand(points: Terrain4Points, side: AOSide, fraction: number): Terrain4Points {
  const [tl, tr, br, bl] = points;
  // Keep the polygon perimeter ordered clockwise. A self-crossing north band
  // can rasterize as a blinking half-strip while the camera moves.
  const top = [tl, tr, lerp(tr, br, fraction), lerp(tl, bl, fraction)] as const;
  const bottom = [lerp(tl, bl, 1 - fraction), lerp(tr, br, 1 - fraction), br, bl] as const;
  const left = [tl, lerp(tl, tr, fraction), lerp(bl, br, fraction), bl] as const;
  const right = [lerp(tl, tr, 1 - fraction), tr, br, lerp(bl, br, 1 - fraction)] as const;
  return { north: top, south: bottom, east: right, west: left }[side];
}

function cornerPatch(points: Terrain4Points, corner: AOCorner, fraction: number): Terrain4Points {
  const [tl, tr, br, bl] = points;
  const at = (u: number, v: number): Terrain4ScreenPoint => lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
  const [u0, u1] = cornerAxis(corner, "w", fraction);
  const [v0, v1] = cornerAxis(corner, "n", fraction);
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

function cornerAxis(corner: AOCorner, direction: "w" | "n", fraction: number): readonly [number, number] {
  return corner.includes(direction) ? [0, fraction] : [1 - fraction, 1];
}

function lerp(a: Terrain4ScreenPoint, b: Terrain4ScreenPoint, amount: number): Terrain4ScreenPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function fillQuad(graphics: Phaser.GameObjects.Graphics, points: Terrain4Points): void {
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
