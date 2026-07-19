// A walkable top's edge outline, including the ONLY horizontal boundary lines
// the renderer draws: a cap/dash exists solely where the cell above the line is
// this walkable top and the cell below is the TOP row of a face (raised or pit)
// descending FROM this top — never at face feet or above higher surfaces.
import { WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";
import { faceRunPieceAt, ownFaceRowAt } from "./ownFace.js";
import { pitFaceRowAt, pitRunPieceAt } from "./pitFace.js";

export interface TopEdges {
  /** Draw wall_edge_mid_left: the west neighbor is meaningfully lower. */
  readonly west: boolean;
  /** Draw wall_edge_mid_right: the east neighbor is meaningfully lower. */
  readonly east: boolean;
  /** Draw wall_top_mid flipY: the north neighbor is meaningfully lower. */
  readonly north: boolean;
  /** Draw wall_edge_bottom_left (side line turning into the dash): west and south both drop here. */
  readonly southCornerLeft: boolean;
  /** Draw wall_edge_bottom_right: east and south both drop here. */
  readonly southCornerRight: boolean;
  /** Draw wall_edge_top_left (dash terminated on its west end): the face run below ends there — corner, not T. */
  readonly southDashEndWest: boolean;
  /** Draw wall_edge_top_right: the face run below ends on its east side. */
  readonly southDashEndEast: boolean;
  /** Draw the plain full-width wall_top_mid dash, when no corner/termination applies. */
  readonly southDash: boolean;
}

const NO_EDGES: TopEdges = {
  west: false,
  east: false,
  north: false,
  southCornerLeft: false,
  southCornerRight: false,
  southDashEndWest: false,
  southDashEndEast: false,
  southDash: false,
};

interface RunClosures {
  readonly closeWest: boolean;
  readonly closeEast: boolean;
}

interface SouthPieces {
  readonly cornerLeft: boolean;
  readonly cornerRight: boolean;
  readonly dashEndWest: boolean;
  readonly dashEndEast: boolean;
  readonly dash: boolean;
}

const NO_SOUTH: SouthPieces = {
  cornerLeft: false,
  cornerRight: false,
  dashEndWest: false,
  dashEndEast: false,
  dash: false,
};

/** True when (wx, wy) sits at least a face-worthy drop above its neighbor — ownFace.ts's threshold, any direction. */
function dropsTo(world: TerrainRead, wx: number, wy: number, nx: number, ny: number): boolean {
  return world.heightAt(wx, wy) - world.heightAt(nx, ny) >= WALL_FACE_MIN_DROP;
}

/**
 * The run closures of the face TOP row directly south of this cell, or null
 * when the south cell is not the top row of a face descending from THIS top
 * (rule: same surface height; a higher surface's face gets no dash from us).
 */
function southFaceTopBelow(world: TerrainRead, wx: number, wy: number): RunClosures | null {
  const topHeight = world.heightAt(wx, wy);
  const own = ownFaceRowAt(world, wx, wy + 1);
  if (own !== null) {
    if (own.rowFromTop !== 1 || Math.abs(own.surfaceHeight - topHeight) > 0.01) return null;
    return faceRunPieceAt(world, wx, wy + 1);
  }
  const pit = pitFaceRowAt(world, wx, wy + 1);
  if (pit !== null && pit.rowFromTop === 1 && Math.abs(pit.surfaceHeight - topHeight) <= 0.01) {
    return pitRunPieceAt(world, wx, wy + 1);
  }
  return null;
}

/** The dash/corner combination for a qualifying south boundary: side edges turn corners, run ends terminate the dash. */
function southPieces(southTop: RunClosures | null, west: boolean, east: boolean): SouthPieces {
  if (southTop === null) return NO_SOUTH;
  const cornerLeft = west;
  const cornerRight = east;
  const dashEndWest = !cornerLeft && southTop.closeWest;
  const dashEndEast = !cornerRight && southTop.closeEast;
  const dash = !cornerLeft && !cornerRight && !dashEndWest && !dashEndEast;
  return { cornerLeft, cornerRight, dashEndWest, dashEndEast, dash };
}

/**
 * Every outline piece a walkable top cell needs so a ledge's silhouette is
 * fully bordered. Where the top's own side edge meets the dash, the two merge
 * into the side-turning corner piece; where only the face RUN below ends, the
 * dash keeps its full width but terminates that end so the face's vertical
 * below turns a clean corner instead of hanging off a through-going line.
 */
export function topEdgesAt(world: TerrainRead, wx: number, wy: number): TopEdges {
  if (ownFaceRowAt(world, wx, wy) !== null || pitFaceRowAt(world, wx, wy) !== null) return NO_EDGES;
  const west = dropsTo(world, wx, wy, wx - 1, wy);
  const east = dropsTo(world, wx, wy, wx + 1, wy);
  const north = dropsTo(world, wx, wy, wx, wy - 1);
  const south = southPieces(southFaceTopBelow(world, wx, wy), west, east);
  return {
    west: west && !south.cornerLeft,
    east: east && !south.cornerRight,
    north,
    southCornerLeft: south.cornerLeft,
    southCornerRight: south.cornerRight,
    southDashEndWest: south.dashEndWest,
    southDashEndEast: south.dashEndEast,
    southDash: south.dash,
  };
}
