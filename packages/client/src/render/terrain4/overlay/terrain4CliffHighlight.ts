import type Phaser from "phaser";
import type { Terrain4ScreenPoint, Terrain4ScreenProjection } from "../phaser4QuadBatch.js";
import type { Terrain4Batches, Terrain4CliffEdgeQuad, Terrain4QuadVertices } from "../geometry/terrainPlannerModel.js";
import { depthForCapOccluder } from "../../entities/depthSort.js";

const RIM_FRACTION = 0.05;
const RIM_COLOR = 0xf7f0c9;
const RIM_ALPHA = 1;

/** Cheap post-process rim: one Graphics layer per depth row, no per-tile sprites. */
export class Terrain4CliffHighlightRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(edges: Terrain4Batches["cliffEdges"], projection: Terrain4ScreenProjection, visible: boolean): void {
    const grouped = new Map<number, HighlightPart[]>();
    for (const edge of edges) appendEdgeParts(grouped, edge);
    for (const graphics of this.layers.values()) graphics.clear().setVisible(false);
    for (const [depth, group] of grouped) {
      const graphics = this.layers.get(depth) ?? this.createLayer(depth);
      graphics.clear().setVisible(visible).fillStyle(RIM_COLOR, RIM_ALPHA);
      drawEdges(graphics, group, projection);
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

function appendEdgeParts(grouped: Map<number, HighlightPart[]>, edge: Terrain4CliffEdgeQuad): void {
  for (const side of edge.sides) appendEdgePart(grouped, edge, side);
}

function appendEdgePart(grouped: Map<number, HighlightPart[]>, edge: Terrain4CliffEdgeQuad, side: HighlightPart["side"]): void {
  const depth = edgeDepth(edge, side); const group = grouped.get(depth) ?? [];
  if (!grouped.has(depth)) grouped.set(depth, group);
  group.push({ edge, side });
}

function drawEdges(
  graphics: Phaser.GameObjects.Graphics,
  edges: readonly HighlightPart[],
  projection: Terrain4ScreenProjection,
): void {
  for (const { edge, side } of edges) {
    const points = projectQuad(edge.vertices, projection);
    fillQuad(graphics, sideBand(points, side, RIM_FRACTION));
  }
}

interface HighlightPart {
  readonly edge: Terrain4CliffEdgeQuad;
  readonly side: "north" | "south" | "east" | "west";
}

function edgeDepth(edge: Terrain4CliffEdgeQuad, side: HighlightPart["side"]): number {
  // A north/south rim sits on a row boundary. Place it above the lower cap's
  // AO, rather than depth-sorting it with only the higher source tile.
  const boundaryRow = side === "south" ? edge.viewTile.y + 1 : edge.viewTile.y;
  return depthForCapOccluder(boundaryRow) + 0.08;
}

function projectQuad(vertices: Terrain4QuadVertices, projection: Terrain4ScreenProjection): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  return [projection.project(vertices[0]), projection.project(vertices[1]), projection.project(vertices[2]), projection.project(vertices[3])];
}

function sideBand(points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint], side: "north" | "south" | "east" | "west", fraction: number): readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint] {
  const [tl, tr, br, bl] = points;
  // Keep the polygon perimeter ordered clockwise. The previous north order
  // ended with BL, BR, producing a self-crossing bow-tie and a moving
  // left-biased half-fill as the camera scrolled.
  const top = [tl, tr, lerp(tr, br, fraction), lerp(tl, bl, fraction)] as const;
  const bottom = [lerp(tl, bl, 1 - fraction), lerp(tr, br, 1 - fraction), br, bl] as const;
  const left = [tl, lerp(tl, tr, fraction), lerp(bl, br, fraction), bl] as const;
  const right = [lerp(tl, tr, 1 - fraction), tr, br, lerp(bl, br, 1 - fraction)] as const;
  return { north: top, south: bottom, east: right, west: left }[side];
}

function lerp(a: Terrain4ScreenPoint, b: Terrain4ScreenPoint, amount: number): Terrain4ScreenPoint {
  return { x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount };
}

function fillQuad(graphics: Phaser.GameObjects.Graphics, points: readonly [Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint, Terrain4ScreenPoint]): void {
  const [a, b, c, d] = points;
  // Keep the rim as one path. Two independently rasterized triangles share a
  // diagonal that can shimmer or alpha-stack as the camera scrolls by
  // sub-pixels, making half of a north rim or AO band appear to blink.
  graphics.beginPath();
  graphics.moveTo(a.x, a.y);
  graphics.lineTo(b.x, b.y);
  graphics.lineTo(c.x, c.y);
  graphics.lineTo(d.x, d.y);
  graphics.closePath();
  graphics.fillPath();
}
