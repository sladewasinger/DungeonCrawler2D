import { smoothstep01 } from "../../../core/math.js";
import { WALL_DOOR_FEATURE_HEIGHT } from "../../../core/constants.js";
import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../../core/types.js";
import { finiteFloorForRuntime, type GeneratedFloor } from "../../generate/finiteFloor.js";
import { WORLD_GENERATION_TUNING } from "../../generate/tuning.js";
import type { WorldChunk } from "../descent/descentShared.js";

/**
 * Fixed features placed deterministically per floor: safe-room
 * entrances and stairways on sparse chunk grids, cleared, flattened,
 * and height-blended into the surrounding terrain.
 */

const FIXED_FEATURES = WORLD_GENERATION_TUNING.fixedFeatures;

export function isSafeRoomChunk(chunk: WorldChunk): boolean {
  return finiteFloorForRuntime(chunk).safeRooms.some((site) =>
    Math.floor(site.door.x / CHUNK_SIZE) === chunk.cx &&
    Math.floor(site.door.y / CHUNK_SIZE) === chunk.cy,
  );
}

export function isStairsChunk(chunk: WorldChunk): boolean {
  if (isSafeRoomChunk(chunk)) return false;
  const floor = finiteFloorForRuntime(chunk);
  return [...floor.downStairways, ...(floor.upStairway ? [floor.upStairway] : [])]
    .some((stairway) => stairway.chunk.cx === chunk.cx && stairway.chunk.cy === chunk.cy);
}

export interface FeatureLayout {
  safeRoom: boolean;
  half: number;
  centerLx: number;
  centerLy: number;
  featureH: number;
}

/** Where the feature sits and how tall its flattened pad is (pure). */
export function featureLayout(chunk: WorldChunk): FeatureLayout | null {
  const floor = finiteFloorForRuntime(chunk);
  const safe = safeRoomForChunk(floor, chunk);
  const stairPosition = stairPositionForChunk(floor, chunk);
  if (!safe && !stairPosition) return null;
  return buildFeatureLayout({ chunk, safe, stairPosition });
}

function buildFeatureLayout(input: { readonly chunk: WorldChunk; readonly safe: ReturnType<typeof safeRoomForChunk>; readonly stairPosition: ReturnType<typeof stairPositionForChunk> }): FeatureLayout {
  const safeRoom = input.safe !== undefined;
  const center = featureCenter(input, safeRoom);
  return {
    safeRoom,
    half: featureHalf(safeRoom),
    centerLx: center.x - input.chunk.cx * CHUNK_SIZE,
    centerLy: center.y - input.chunk.cy * CHUNK_SIZE,
    featureH: 0,
  };
}

function featureCenter(input: { readonly safe: ReturnType<typeof safeRoomForChunk>; readonly stairPosition: ReturnType<typeof stairPositionForChunk> }, safeRoom: boolean): { x: number; y: number } {
  return safeRoom ? safeCenter(input.safe) : stairCenter(input.stairPosition);
}

function safeCenter(site: ReturnType<typeof safeRoomForChunk>): { x: number; y: number } {
  return { x: site?.door.x ?? 0, y: (site?.door.y ?? 0) - 1 };
}

function stairCenter(position: ReturnType<typeof stairPositionForChunk>): { x: number; y: number } {
  return { x: position?.x ?? 0, y: position?.y ?? 0 };
}

function featureHalf(safeRoom: boolean): number { return safeRoom ? FIXED_FEATURES.kioskHalfWidth : 1; }

function safeRoomForChunk(floor: GeneratedFloor, chunk: WorldChunk) {
  return floor.safeRooms.find((site) => Math.floor(site.door.x / CHUNK_SIZE) === chunk.cx && Math.floor(site.door.y / CHUNK_SIZE) === chunk.cy);
}

function stairPositionForChunk(floor: GeneratedFloor, chunk: WorldChunk) {
  return [...floor.downStairways, ...(floor.upStairway ? [floor.upStairway] : [])]
    .find((site) => site.chunk.cx === chunk.cx && site.chunk.cy === chunk.cy)?.position;
}

/** Stamp the flattened pad and its height-blend apron into `tiles`/`height`. */
interface FeatureBuffers {
  tiles: Uint8Array;
  height: Float32Array;
}

interface FeaturePlanes {
  featureTiles: Uint8Array;
  featureFaces: Uint8Array;
  featureHeight: Float32Array;
}

function stampFeaturePad(layout: FeatureLayout, buffers: FeatureBuffers): void {
  const { tiles, height } = buffers;
  const { half, centerLx, centerLy, featureH } = layout;
  const margin = FIXED_FEATURES.safeRoomBlendMargin;
  const reach = half + margin;
  for (let ly = centerLy - reach; ly <= centerLy + reach; ly++) {
    for (let lx = centerLx - reach; lx <= centerLx + reach; lx++) {
      stampFeatureCell({ lx, ly, centerLx, centerLy, half, margin, featureH, tiles, height });
    }
  }
}

interface FeatureCell extends FeatureBuffers {
  lx: number;
  ly: number;
  centerLx: number;
  centerLy: number;
  half: number;
  margin: number;
  featureH: number;
}

function stampFeatureCell(cell: FeatureCell): void {
  if (!isChunkCell(cell.lx, cell.ly)) return;
  const index = cell.ly * CHUNK_SIZE + cell.lx;
  const distance = Math.max(Math.abs(cell.lx - cell.centerLx), Math.abs(cell.ly - cell.centerLy));
  cell.tiles[index] = TILE.Floor;
  cell.height[index] = blendedFeatureHeight(cell, index, distance);
}

function isChunkCell(lx: number, ly: number): boolean {
  return lx >= 0 && ly >= 0 && lx < CHUNK_SIZE && ly < CHUNK_SIZE;
}

function blendedFeatureHeight(cell: FeatureCell, index: number, distance: number): number {
  if (distance <= cell.half) return cell.featureH;
  const blend = smoothstep01((distance - cell.half) / cell.margin);
  return cell.featureH + ((cell.height[index] ?? 0) - cell.featureH) * blend;
}

/** Safe rooms and stairways: cleared, flattened, height-blended into terrain. */
export interface FlattenedFeatureContext extends FeatureBuffers, FeaturePlanes {
  chunk: WorldChunk;
}

export function applyFlattenedFeature(context: FlattenedFeatureContext): void {
  const layout = featureLayout(context.chunk);
  if (!layout) return;

  stampFeaturePad(layout, context);

  if (layout.safeRoom) {
    // The safe room itself is an instanced stretch room (rooms.ts); the
    // overworld only gets its entrance: a raised kiosk TERRACE (walkable
    // floor, not a TOPOLOGY.Uncarved mass — user-decreed 2026-07-19, see
    // VISUAL_DIRECTION.md's wall vertical-extent rule) whose south face
    // carries a portal door (GAME_DESIGN.md § Safe rooms).
    carveSafeRoomEntrance({ ...context, ...layout });
  }
}

/** Height of the kiosk terrace: z2, satisfying the generator's z+1 vertical-extent floor (docs/VISUAL_DIRECTION.md). */
export const KIOSK_HEIGHT = FIXED_FEATURES.kioskHeight;

/**
 * How far the terrace reaches NORTH of its door row. ownFace.ts's face
 * model gives a flush height-KIOSK_HEIGHT drop exactly KIOSK_HEIGHT rows
 * of brick face (rowsOnRaised caps at the drop's own magnitude) before any
 * row reads as walkable top — so the two rows immediately behind the door
 * are ALWAYS face, never top, no matter how deep the terrace goes. A
 * genuinely flat, walkable-looking platform needs KIOSK_HEIGHT MORE rows
 * beyond that (docs/ROADMAP.md's "platform above the door" user spec,
 * 2026-07-20: "deepen that platform to 2 tiles north-south" — the terrace
 * used to stop exactly at the face rows, leaving a bare notch of brick
 * directly behind the door where every OTHER kiosk column already showed
 * flat top one row sooner — the "visible seam/split" complaint).
 */
const TERRACE_TOP_ROWS = FIXED_FEATURES.kioskTopDepth;
/** Rows from the door (exclusive) to the terrace's northmost row. */
const TERRACE_NORTH_REACH = KIOSK_HEIGHT + TERRACE_TOP_ROWS - 1;

/**
 * 5-wide x 5-deep kiosk TERRACE: a raised, walkable floor dais (not solid
 * raised terrain) whose southernmost KIOSK_HEIGHT rows are its face, with
 * TERRACE_TOP_ROWS more of genuine flat top behind that at
 * EVERY column, door column included. The door is authored independently on
 * the feature plane at z1, so the wall and walkable terrace above it remain
 * intact while the renderer replaces only the bottom wall-face segment.
 */
interface SafeRoomEntrance extends FeatureBuffers, FeaturePlanes {
  centerLx: number;
  centerLy: number;
}

export function carveSafeRoomEntrance(entrance: SafeRoomEntrance): void {
  const {
    tiles, height, featureTiles, featureFaces, featureHeight, centerLx, centerLy,
  } = entrance;
  const halfWidth = FIXED_FEATURES.kioskHalfWidth;
  for (let dy = -TERRACE_NORTH_REACH; dy <= 1; dy++) {
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      stampTerraceCell({ tiles, height, lx: centerLx + dx, ly: centerLy + dy });
    }
  }
  const doorLy = centerLy + 1;
  if (doorLy < CHUNK_SIZE) {
    const doorIndex = doorLy * CHUNK_SIZE + centerLx;
    featureTiles[doorIndex] = TILE.DoorSafeRoom;
    featureFaces[doorIndex] = FEATURE_FACE.South;
    featureHeight[doorIndex] = WALL_DOOR_FEATURE_HEIGHT;
  }
}

function stampTerraceCell(cell: FeatureBuffers & { lx: number; ly: number }): void {
  if (!isChunkCell(cell.lx, cell.ly)) return;
  const index = cell.ly * CHUNK_SIZE + cell.lx;
  cell.tiles[index] = TILE.Floor;
  cell.height[index] = KIOSK_HEIGHT;
}
