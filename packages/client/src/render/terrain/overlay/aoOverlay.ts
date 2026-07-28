import type Phaser from "phaser";
import { AO_BAND_FRACS, AO_CORNER_FRAC, aoBandAlphas, aoCornerAlpha, getAOStrength } from "../../terrain/shading/contactShade.js";
import type { TerrainScreenPoint, TerrainScreenProjection } from "../batch/quadBatch.js";
import type { TerrainAOQuad, TerrainBatches, TerrainQuadVertices } from "../geometry/terrainPlannerModel.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import { ambientOcclusionDepth } from "./ambientOcclusionDepth.js";

const AO_COLOR = phaserColor(TERRAIN_VISUAL_STYLE.ambientOcclusion.color);

/** One Graphics object per depth row keeps AO batched while preserving entity ordering. */
export class TerrainAOOverlayRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(masks: TerrainBatches["ao"], projection: TerrainScreenProjection, visible: boolean): void {
    const grouped = groupByDepth(masks);
    for (const graphics of this.layers.values()) graphics.clear().setVisible(false);
    for (const [depth, group] of grouped) {
      const graphics = this.layers.get(depth) ?? this.createLayer(depth);
      graphics.clear().setVisible(visible).fillStyle(AO_COLOR, 1);
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
  | { readonly quad: TerrainAOQuad; readonly region: AOSide }
  | { readonly quad: TerrainAOQuad; readonly region: AOCorner };

function groupByDepth(masks: TerrainBatches["ao"]): Map<number, AOPart[]> {
  const grouped = new Map<number, AOPart[]>();
  for (const mask of masks) appendMaskParts(grouped, mask);
  return grouped;
}

function appendMaskParts(grouped: Map<number, AOPart[]>, quad: TerrainAOQuad): void {
  appendRegions(grouped, quad, ["north", "east", "south", "west"]);
  appendRegions(grouped, quad, ["nw", "ne", "sw", "se"]);
}

function appendRegions(grouped: Map<number, AOPart[]>, quad: TerrainAOQuad, regions: readonly AOPart["region"][]): void {
  for (const region of regions) if (quad.mask[region]) appendPart(grouped, quad, region);
}

function appendPart(grouped: Map<number, AOPart[]>, quad: TerrainAOQuad, region: AOPart["region"]): void {
  const depth = ambientOcclusionDepth(quad);
  const group = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, group);
  group.push({ quad, region });
}

function drawGroup(
  graphics: Phaser.GameObjects.Graphics,
  parts: readonly AOPart[],
  projection: TerrainScreenProjection,
): void {
  const alphas = aoBandAlphas(getAOStrength());
  for (const part of parts) drawPart({ graphics, part, projection, alphas });
}

interface DrawPartInput { readonly graphics: Phaser.GameObjects.Graphics; readonly part: AOPart; readonly projection: TerrainScreenProjection; readonly alphas: readonly number[]; }

function drawPart(input: DrawPartInput): void {
  const points = projectQuad(input.part.quad.vertices, input.projection);
  if (isCorner(input.part.region)) return drawCorner(input.graphics, points, input.part.region);
  drawSideBands({ graphics: input.graphics, points, side: input.part.region, alphas: input.alphas });
}

function isCorner(region: AOPart["region"]): region is AOCorner { return region.length === 2; }

function drawCorner(graphics: Phaser.GameObjects.Graphics, points: TerrainPoints, corner: AOCorner): void {
  graphics.fillStyle(AO_COLOR, aoCornerAlpha(getAOStrength()));
  fillQuad(graphics, cornerPatch(points, corner, AO_CORNER_FRAC));
}

function drawSideBands(input: DrawSideBandsInput): void {
  for (let band = 0; band < AO_BAND_FRACS.length; band += 1) {
    input.graphics.fillStyle(AO_COLOR, input.alphas[band] ?? 0);
    const fraction = AO_BAND_FRACS[band] ?? 0;
    fillQuad(input.graphics, sideBand(input.points, input.side, fraction));
  }
}

interface DrawSideBandsInput { readonly graphics: Phaser.GameObjects.Graphics; readonly points: TerrainPoints; readonly side: AOSide; readonly alphas: readonly number[]; }

type TerrainPoints = readonly [TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint];

function projectQuad(vertices: TerrainQuadVertices, projection: TerrainScreenProjection): TerrainPoints {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function sideBand(points: TerrainPoints, side: AOSide, fraction: number): TerrainPoints {
  const [tl, tr, br, bl] = points;
  // Keep the polygon perimeter ordered clockwise. A self-crossing north band
  // can rasterize as a blinking half-strip while the camera moves.
  const top = [tl, tr, lerp(tr, br, fraction), lerp(tl, bl, fraction)] as const;
  const bottom = [lerp(tl, bl, 1 - fraction), lerp(tr, br, 1 - fraction), br, bl] as const;
  const left = [tl, lerp(tl, tr, fraction), lerp(bl, br, fraction), bl] as const;
  const right = [lerp(tl, tr, 1 - fraction), tr, br, lerp(bl, br, 1 - fraction)] as const;
  return { north: top, south: bottom, east: right, west: left }[side];
}

function cornerPatch(points: TerrainPoints, corner: AOCorner, fraction: number): TerrainPoints {
  const [tl, tr, br, bl] = points;
  const at = (u: number, v: number): TerrainScreenPoint => lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
  const [u0, u1] = cornerAxis(corner, "w", fraction);
  const [v0, v1] = cornerAxis(corner, "n", fraction);
  return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
}

function cornerAxis(corner: AOCorner, direction: "w" | "n", fraction: number): readonly [number, number] {
  return corner.includes(direction) ? [0, fraction] : [1 - fraction, 1];
}

function lerp(a: TerrainScreenPoint, b: TerrainScreenPoint, amount: number): TerrainScreenPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function fillQuad(graphics: Phaser.GameObjects.Graphics, points: TerrainPoints): void {
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
