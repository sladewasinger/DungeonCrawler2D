// Composed multi-tile structures (doors): each draws as a standalone leaf, bottom-
// anchored on its tile, over whatever the ordinary terrain pass already rendered
// there (VISUAL_DIRECTION.md's wall vertical-extent rule) — no suppression, no
// hand-drawn frame/facade duplicating what drawTile.ts's face/wall art already owns.
import { TILE, type TileType } from "@dc2d/engine";
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";

const SANCTUARY_TEAL = 0x8fe8db;

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
  if (door.tile === TILE.DoorSafeRoom) return [];
  return [-2, -1, 1, 2]
    .filter((dx) => tileAt(door.wx + dx, door.wy) === TILE.Wall)
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

function addPiece(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  frame: string,
  bottomCenterX: number,
  bottomY: number,
  tint?: number,
): void {
  const sprite = scene.add.sprite(bottomCenterX, bottomY, ASSET_KEYS.atlas, frame);
  sprite.setOrigin(0.5, 1);
  sprite.setScale(WORLD_PIXEL_SCALE);
  if (tint !== undefined) sprite.setTint(tint);
  container.add(sprite);
}

/**
 * Draws one door as its standalone leaf, bottom-anchored on the door tile's
 * south edge (user-decreed 2026-07-19, see VISUAL_DIRECTION.md's wall
 * vertical-extent rule): no frame posts, no lintel, no hand-drawn kiosk
 * facade — the ordinary terrain pass (drawTile.ts) already drew this cell's
 * ground/face art (a kiosk terrace's face row, an ordinary wall's brick
 * shading), and the leaf sits on top of it, "punched into" the wall/face
 * exactly like any other composed structure.
 */
export function drawDoor(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  door: DoorStructure,
): void {
  const centerX = door.wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const bottomY = (door.wy + 1) * SCREEN_TILE_PX;
  addPiece(scene, container, "doors_leaf_closed", centerX, bottomY, SANCTUARY_TEAL);
}
