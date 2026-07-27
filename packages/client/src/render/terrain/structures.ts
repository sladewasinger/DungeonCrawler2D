// Composed multi-tile structures (doors): each draws as a standalone leaf, bottom-
// anchored on its tile, over whatever the ordinary terrain pass already rendered
// there (VISUAL_DIRECTION.md's wall vertical-extent rule) — no suppression, no
// hand-drawn frame/facade duplicating what drawTile.ts's face/wall art already owns.
import { TILE, type TileType } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { uiTextStyle } from "../../ui/font.js";
import { depthForOccluder } from "../entities/depthSort.js";
import { placeDebugTile } from "./debugSprite.js";
import { FRAME_DOOR } from "./debugTileset.js";

const DOOR_LABEL_OFFSET_DISPLAY_PX = 4;
const DOOR_LABEL_FONT_DISPLAY_PX = 9;
const DOOR_LABEL_STROKE_DISPLAY_PX = 3;
const DOOR_LABEL_DEPTH_BIAS = 0.01;

const DOOR_TINT: Readonly<Record<number, number>> = {
  [TILE.DoorSafeRoom]: 0x68a8ff,
  [TILE.DoorParty]: 0xff75c8,
  [TILE.DoorPersonal]: 0x79e89a,
  [TILE.DoorExit]: 0xffd36a,
};

const DOOR_LABEL: Readonly<Record<number, string>> = {
  [TILE.DoorSafeRoom]: "SAFE ROOM",
  [TILE.DoorExit]: "EXIT",
};

const DOOR_TILES: ReadonlySet<TileType> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

export interface DoorStructure {
  /** Tile holding the engine's door — the walkable portal cell. */
  readonly wx: number;
  readonly wy: number;
  readonly tile: TileType;
}

export interface StructureMap {
  readonly doors: readonly DoorStructure[];
  /**
   * Tiles whose terrain art is fully suppressed (the structure draws
   * instead). Always empty for doors (user-decreed 2026-07-19, see
   * VISUAL_DIRECTION.md's wall vertical-extent rule): a door's leaf is a
   * standalone piece drawn OVER whatever the ordinary terrain renderer
   * already puts down — a face row for a wall/terrace doorway, plain ground
   * otherwise — so the surface it's punched into (a kiosk terrace's top
   * platform, an ordinary wall's brick shading) stays exactly like its
   * neighbors, never masked out. Kept in the shape for other composed
   * structures (chests, fountains — VISUAL_DIRECTION.md's "composed
   * structures are atomic" rule) that may still need it.
   */
  readonly suppressed: ReadonlySet<string>;
  /** Wall cells whose projected south face would protrude below a door frame. */
  readonly faceSuppressed: ReadonlySet<string>;
}

export const tileKey = (wx: number, wy: number): string => `${wx},${wy}`;

/** Sideways reach for a door's faceSuppressed scan, into the neighboring chunk. */
const FOOTPRINT_SIDE_REACH = 2;

function doorFaceFootprint(
  door: DoorStructure,
  tileAt: (wx: number, wy: number) => TileType,
): string[] {
  // Faces are derived from adjacent finite Floor heights; doors do not need
  // a categorical wall footprint to suppress them.
  if (door.tile === TILE.DoorSafeRoom) return [];
  return [-2, -1, 1, 2]
    .filter((dx) => tileAt(door.wx + dx, door.wy) !== TILE.Void)
    .map((dx) => tileKey(door.wx + dx, door.wy));
}

/**
 * Scans a tile-range for door tiles and precomputes the faceSuppressed mask
 * (doors carry no suppression footprint of their own — see doorFaceFootprint).
 * The scan overshoots `FOOTPRINT_SIDE_REACH` columns past x0/x1 so a door just
 * over this chunk's east/west seam still contributes the faceSuppressed cells
 * it reaches into — but only doors whose own tile lies inside [x0, x1) x
 * [y0, y1) are DRAWN by this chunk (the owning chunk draws the leaf exactly
 * once).
 */
export function buildStructureMap(
  tileAt: (wx: number, wy: number) => TileType,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): StructureMap {
  const doors: DoorStructure[] = [];
  const suppressed = new Set<string>();
  const faceSuppressed = new Set<string>();
  for (let wy = y0; wy < y1; wy++) {
    for (let wx = x0 - FOOTPRINT_SIDE_REACH; wx < x1 + FOOTPRINT_SIDE_REACH; wx++) {
      if (!DOOR_TILES.has(tileAt(wx, wy))) continue;
      const door = { wx, wy, tile: tileAt(wx, wy) };
      if (wx >= x0 && wx < x1) doors.push(door);
      for (const key of doorFaceFootprint(door, tileAt)) faceSuppressed.add(key);
    }
  }
  return { doors, suppressed, faceSuppressed };
}

/**
 * Draws one door as its standalone leaf, on top of the door tile (user-decreed
 * 2026-07-19, see VISUAL_DIRECTION.md's wall vertical-extent rule): no frame
 * posts, no lintel, no hand-drawn kiosk facade — the ordinary terrain pass
 * (drawTile.ts) already drew this cell's ground/face art (a kiosk terrace's
 * face row, an ordinary wall's brick shading), and the leaf sits on top of it,
 * "punched into" the wall/face exactly like any other composed structure. Art
 * is the debug tileset's single door frame (2.5D rotation lane — retires the
 * retired pack-art door path), tinted the same sanctuary teal as
 * before regardless of door type.
 */
export function drawDoor(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  door: DoorStructure,
): void {
  const tint = DOOR_TINT[door.tile] ?? 0xffffff;
  placeDebugTile(scene, container, door.wx, door.wy, FRAME_DOOR, { tint });
}

export function createDoorLabel(
  scene: Phaser.Scene,
  door: DoorStructure,
): Phaser.GameObjects.Text | null {
  const label = DOOR_LABEL[door.tile];
  if (!label) return null;
  return scene.add.text(
    (door.wx + 0.5) * SCREEN_TILE_PX,
    door.wy * SCREEN_TILE_PX - DOOR_LABEL_OFFSET_DISPLAY_PX,
    label,
    uiTextStyle(DOOR_LABEL_FONT_DISPLAY_PX, "#ffffff", 1, "emphasis"),
  ).setOrigin(0.5, 1)
    .setStroke("#11111a", DOOR_LABEL_STROKE_DISPLAY_PX)
    .setDepth(depthForOccluder(door.wy + 1) + DOOR_LABEL_DEPTH_BIAS)
    .setName("terrain-door-label")
    .setVisible(false);
}
