// Composed multi-tile structures (doors): each has an explicit tile footprint that
// suppresses ALL terrain art beneath it, and its frame/leaf pieces assemble as one
// bottom-anchored unit — masonry never draws through a structure again.
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
  /** Tiles whose terrain art is fully suppressed (the structure draws instead). */
  readonly suppressed: ReadonlySet<string>;
  /** Wall cells whose projected south face would protrude below a door frame. */
  readonly faceSuppressed: ReadonlySet<string>;
}

export const tileKey = (wx: number, wy: number): string => `${wx},${wy}`;

/**
 * Ordinary doors own their three-cell vertical assembly. A safe-room portal owns
 * its complete 5x3 kiosk facade so procedural contour art cannot leave stray caps
 * or short side walls around the taller door.
 */
function doorFootprint(door: DoorStructure): string[] {
  if (door.tile === TILE.DoorSafeRoom) {
    const footprint: string[] = [];
    for (let dy = -2; dy <= 0; dy++) {
      for (let dx = -2; dx <= 2; dx++) footprint.push(tileKey(door.wx + dx, door.wy + dy));
    }
    return footprint;
  }
  return [
    tileKey(door.wx, door.wy),
    tileKey(door.wx, door.wy - 1),
    tileKey(door.wx, door.wy - 2),
  ];
}

/** Rows a door's footprint extends above its own tile — the seam-scan overshoot. */
const FOOTPRINT_REACH = 2;
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
 * Scans a tile-range for door tiles and precomputes the suppression mask. The
 * scan overshoots `FOOTPRINT_REACH` rows past y1 so a door just below this
 * chunk's south seam still suppresses the footprint cells it reaches up into —
 * but only doors whose own tile lies inside [y0, y1) are DRAWN by this chunk
 * (the owning chunk draws the assembly exactly once).
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
  for (let wy = y0; wy < y1 + FOOTPRINT_REACH; wy++) {
    for (let wx = x0 - FOOTPRINT_SIDE_REACH; wx < x1 + FOOTPRINT_SIDE_REACH; wx++) {
      if (!DOOR_TILES.has(tileAt(wx, wy))) continue;
      const door = { wx, wy, tile: tileAt(wx, wy) };
      if (wx >= x0 && wx < x1 && wy < y1) doors.push(door);
      for (const key of doorFootprint(door)) suppressed.add(key);
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

function drawSafeRoomFacade(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  door: DoorStructure,
): void {
  for (let dy = -2; dy <= 0; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const frame = dx === -2 ? "wall_left" : dx === 2 ? "wall_right" : "wall_mid";
      addPiece(
        scene,
        container,
        frame,
        (door.wx + dx) * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
        (door.wy + dy + 1) * SCREEN_TILE_PX,
      );
    }
  }
  for (let dx = -2; dx <= 2; dx++) {
    const frame = dx === -2 ? "wall_top_left" : dx === 2 ? "wall_top_right" : "wall_top_mid";
    addPiece(
      scene,
      container,
      frame,
      (door.wx + dx) * SCREEN_TILE_PX + SCREEN_TILE_PX / 2,
      (door.wy - 1) * SCREEN_TILE_PX,
    );
  }
}

/**
 * Draws one door as a single assembly, bottom-anchored on the door tile's south
 * edge. The 16x32 posts sit adjacent to the 32x32 leaf exactly as they do in the
 * source sheet, and the 32x16 lintel adds the third visual row. The owning row
 * container sorts the complete assembly against entity feet.
 */
export function drawDoor(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  door: DoorStructure,
): void {
  const centerX = door.wx * SCREEN_TILE_PX + SCREEN_TILE_PX / 2;
  const bottomY = (door.wy + 1) * SCREEN_TILE_PX;
  if (door.tile === TILE.DoorSafeRoom) drawSafeRoomFacade(scene, container, door);
  addPiece(scene, container, "doors_leaf_closed", centerX, bottomY, SANCTUARY_TEAL);
  addPiece(scene, container, "doors_frame_left", centerX - SCREEN_TILE_PX * 1.5, bottomY);
  addPiece(scene, container, "doors_frame_right", centerX + SCREEN_TILE_PX * 1.5, bottomY);
  addPiece(scene, container, "doors_frame_top", centerX, bottomY - 2 * SCREEN_TILE_PX);
}
