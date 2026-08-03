import type Phaser from "phaser";
import type { TerrainScreenPoint, TerrainScreenProjection } from "../batch/quadBatch.js";
import type {
  TerrainBatches,
} from "../geometry/terrainPlannerModel.js";
import { phaserColor, TERRAIN_VISUAL_STYLE } from "../terrainVisualStyle.js";
import { TerrainOverlayLayerPool } from "./pooling/layerPool.js";
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
  constructor(private readonly layers: TerrainOverlayLayerPool) {}

  render(edges: TerrainBatches["cliffEdges"], projection: TerrainScreenProjection, visible: boolean): void {
    const grouped = groupCliffRimParts(edges);
    for (const [depth, group] of grouped) {
      const graphics = this.layers.acquire("cliff-rim", depth, visible).fillStyle(RIM_COLOR, RIM_ALPHA);
      drawEdges(graphics, group, projection);
    }
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
