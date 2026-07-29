import type Phaser from "phaser";
import type { TerrainScreenPoint, TerrainScreenProjection } from "../batch/quadBatch.js";
import type {
  TerrainBatches,
} from "../geometry/terrainPlannerModel.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import { pruneTerrainLayers } from "./layerRetention.js";
import {
  cliffRimSideBand,
  roundedCliffRimCorner,
} from "./cliffRimGeometry.js";
import {
  groupCliffRimParts,
  type CliffRimPart,
} from "./cliffRimParts.js";
import { projectTerrainQuad } from "./projectedTerrainQuad.js";

const RIM_FRACTION = TERRAIN_VISUAL_STYLE.cliffRim.widthFraction;
const CORNER_RADIUS = TERRAIN_VISUAL_STYLE.cliffRim.outsideCornerRadiusFraction;
const RIM_COLOR = phaserColor(TERRAIN_VISUAL_STYLE.cliffRim.floorColor);
const VOID_RIM_COLOR = phaserColor(TERRAIN_VISUAL_STYLE.cliffRim.voidColor);
const RIM_ALPHA = TERRAIN_VISUAL_STYLE.cliffRim.alpha;

/** Cheap post-process rim: one Graphics layer per depth row, no per-tile sprites. */
export class TerrainCliffHighlightRenderer {
  private readonly layers = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(private readonly scene: Phaser.Scene) {}

  render(edges: TerrainBatches["cliffEdges"], projection: TerrainScreenProjection, visible: boolean): void {
    const grouped = groupCliffRimParts(edges);
    pruneTerrainLayers(this.layers, new Set(grouped.keys()));
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

function drawEdges(
  graphics: Phaser.GameObjects.Graphics,
  edges: readonly CliffRimPart[],
  projection: TerrainScreenProjection,
): void {
  for (const part of edges) {
    const points = projectTerrainQuad(part.edge.vertices, projection.project);
    const color = part.edge.voidBoundary === true ? VOID_RIM_COLOR : RIM_COLOR;
    graphics.fillStyle(color, RIM_ALPHA);
    if (part.kind === "corner") {
      fillPolygon(graphics, roundedCliffRimCorner({
        points,
        corner: part.corner,
        radius: CORNER_RADIUS,
        width: RIM_FRACTION,
        segments: TERRAIN_VISUAL_STYLE.cliffRim.outsideCornerSegments,
      }));
      continue;
    }
    fillQuad(graphics, cliffRimSideBand({
      points,
      side: part.side,
      width: RIM_FRACTION,
      corners: part.corners,
      radius: CORNER_RADIUS,
    }));
  }
}

function fillQuad(graphics: Phaser.GameObjects.Graphics, points: readonly [TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint, TerrainScreenPoint]): void {
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

function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly TerrainScreenPoint[],
): void {
  const first = points[0];
  if (!first) return;
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
  graphics.closePath();
  graphics.fillPath();
}
