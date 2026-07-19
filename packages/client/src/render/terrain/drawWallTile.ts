// Wall rendering by contour role. Caps stay on logical wall cells, faces project
// south onto lower ground, and row depth decides whether an overlapping body is
// behind or in front. Boundary tops retain quiet stone texture; deep mass is flat.
import { TILE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { hasSouthFace } from "./faces.js";
import { floorFrame } from "./floorFrame.js";
import { heightTint, WALL_FILL_COLOR } from "./heightShade.js";
import { placeFillRect, placeSprite } from "./placeSprite.js";
import {
  classifyWallCell,
  verticalFaceBridgeSide,
  type SolidNeighbor,
  type VerticalBridgeSide,
  type WallRole,
} from "./wallContour.js";

const WALL_TOP_TINT = 0x505064;

const FACE_TO_CAP: Readonly<Record<string, string>> = {
  wall_left: "wall_top_left",
  wall_mid: "wall_top_mid",
  wall_right: "wall_top_right",
};

const CORNER_NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function placeCornerSurface(scene: Phaser.Scene, world: TerrainWorld, wx: number, wy: number, target: Phaser.GameObjects.Container): void {
  const bordersSanctuary = CORNER_NEIGHBORS.some(
    ([dx, dy]) => world.tileAt(wx + dx, wy + dy) !== TILE.Wall && world.isSanctuary(wx + dx, wy + dy),
  );
  if (bordersSanctuary) {
    placeFillRect(scene, target, wx, wy, WALL_FILL_COLOR);
    return;
  }
  placeSprite(scene, target, wx, wy, floorFrame(wx, wy, world.zoneAt(wx, wy), false), {
    tint: heightTint(world.heightAt(wx, wy)),
  });
}

/** The south perimeter of a sanctuary cavity: render it as a real foreground wall. */
export function isSanctuaryFrontWall(world: TerrainWorld, wx: number, wy: number): boolean {
  return world.tileAt(wx, wy) === TILE.Wall && world.isSanctuary(wx, wy - 1);
}

interface WallDrawContext {
  readonly scene: Phaser.Scene;
  readonly world: TerrainWorld;
  readonly wx: number;
  readonly wy: number;
  readonly occluder: Phaser.GameObjects.Container;
  readonly tint: number;
  readonly isFace: (x: number, y: number) => boolean;
}

type FaceRole = Extract<WallRole, { kind: "face" }>;
type RimRole = Extract<WallRole, { kind: "rim" }>;

function faceCapFrame(role: FaceRole): string {
  if (role.outline.west) return "wall_edge_bottom_left";
  if (role.outline.east) return "wall_edge_bottom_right";
  return FACE_TO_CAP[role.frame] ?? "wall_top_mid";
}

function drawVerticalBridge(ctx: WallDrawContext, side: VerticalBridgeSide): void {
  const { scene, occluder, wx, wy, tint } = ctx;
  placeSprite(scene, occluder, wx, wy, "floor_5", { tint: WALL_TOP_TINT });
  const edge = side === "west" ? "wall_edge_mid_right" : "wall_edge_mid_left";
  placeSprite(scene, occluder, wx, wy, edge, { tint });
  placeSprite(scene, occluder, wx, wy + 1, "floor_5", { tint: WALL_TOP_TINT });
  placeSprite(scene, occluder, wx, wy + 1, "wall_edge_mid_left", { tint });
  placeSprite(scene, occluder, wx, wy + 1, "wall_edge_mid_right", { tint });
}

function drawFaceRole(ctx: WallDrawContext, role: FaceRole, bridgeSide?: VerticalBridgeSide): void {
  const { scene, world, occluder, wx, wy, tint } = ctx;
  const frontWall = isSanctuaryFrontWall(world, wx, wy);
  if (!frontWall && bridgeSide) {
    drawVerticalBridge(ctx, bridgeSide);
    return;
  }
  const capY = frontWall ? wy - 1 : wy;
  if (!frontWall) placeSprite(scene, occluder, wx, capY, "floor_5", { tint: WALL_TOP_TINT });
  placeSprite(scene, occluder, wx, capY, faceCapFrame(role), { tint });
  if (!frontWall && role.outline.north) {
    placeSprite(scene, occluder, wx, capY, "wall_top_mid", { tint, flipY: true });
  }
  placeSprite(scene, occluder, wx, capY + 1, role.frame, { tint });
}

function drawRimFill(ctx: WallDrawContext, role: RimRole): void {
  const { scene, world, occluder, wx, wy } = ctx;
  if (role.art.opaque) return;
  if (role.art.groundFill) {
    placeCornerSurface(scene, world, wx, wy, occluder);
  } else if (role.art.texturedFill) {
    placeSprite(scene, occluder, wx, wy, "floor_5", { tint: WALL_TOP_TINT });
  } else {
    placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
  }
}

function drawRimRole(ctx: WallDrawContext, role: RimRole): void {
  const { scene, world, occluder, wx, wy, tint, isFace } = ctx;
  drawRimFill(ctx, role);
  placeSprite(scene, occluder, wx, wy, role.art.frame, {
    tint,
    ...(role.art.flip ? { flipY: true } : {}),
  });
  const bridgeSolid: SolidNeighbor = (dx, dy) => world.tileAt(wx + dx, wy - 2 + dy) === TILE.Wall;
  const bridgedNorth = verticalFaceBridgeSide(bridgeSolid, isFace(wx, wy - 2)) !== undefined;
  if (role.art.capNorth && !bridgedNorth) {
    placeSprite(scene, occluder, wx, wy, "wall_top_mid", { tint, flipY: true });
  }
  if (role.art.capSouth) placeSprite(scene, occluder, wx, wy, "wall_top_mid", { tint });
  if (role.art.capEast) placeSprite(scene, occluder, wx, wy, "wall_edge_mid_right", { tint });
  if (role.art.projectedFace) placeSprite(scene, occluder, wx, wy + 1, role.art.projectedFace, { tint });
}

export function drawWallTile(
  scene: Phaser.Scene,
  world: TerrainWorld,
  wx: number,
  wy: number,
  occluder: Phaser.GameObjects.Container,
  faceSuppressed: (wx: number, wy: number) => boolean,
): void {
  const tint = heightTint(world.heightAt(wx, wy));
  const solid = (dx: number, dy: number): boolean => world.tileAt(wx + dx, wy + dy) === TILE.Wall;
  const isFace = (x: number, y: number): boolean =>
    !faceSuppressed(x, y) && (hasSouthFace(world, x, y) || isSanctuaryFrontWall(world, x, y));
  const role = classifyWallCell(
    solid,
    isFace(wx, wy),
    (dx) => isFace(wx + dx, wy),
  );
  const bridgeSide = verticalFaceBridgeSide(solid, isFace(wx, wy));
  const ctx = { scene, world, wx, wy, occluder, tint, isFace };

  switch (role.kind) {
    case "pillar":
      // Freestanding obstacle: never wall-run art. Row sorting handles pass-behind.
      placeSprite(scene, occluder, wx, wy, "column", { tint, originY: 1 });
      return;
    case "face":
      drawFaceRole(ctx, role, bridgeSide);
      return;
    case "rim":
      drawRimRole(ctx, role);
      return;
    case "fill":
      placeFillRect(scene, occluder, wx, wy, WALL_FILL_COLOR);
      return;
  }
}
