import { hash2D, mixSeeds } from "../../core/rng.js";
import {
  baseSample,
  seedsFor,
  smoothstep01,
  type CorridorSegment,
  type Seeds,
} from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";

/**
 * Fixed features placed deterministically per floor: safe-room
 * entrances and stairways on sparse chunk grids, cleared, flattened,
 * and height-blended into the surrounding terrain.
 */

const SAFE_ROOM_SPACING = 3; // one safe room per 3×3 chunk cell
const SAFE_ROOM_HALF = 5; // room is (2*half+1)² tiles
const SAFE_ROOM_MARGIN = 3; // height-blend apron around the room

const STAIRS_MODULUS = 23; // ~1 in 23 chunks hosts a stairway

function posMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function isSafeRoomChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  const layout = seedsFor(worldSeed, floor).layout;
  const offX = hash2D(mixSeeds(layout, 0x5afe), 1, 0) % SAFE_ROOM_SPACING;
  const offY = hash2D(mixSeeds(layout, 0x5afe), 0, 1) % SAFE_ROOM_SPACING;
  return posMod(cx, SAFE_ROOM_SPACING) === offX && posMod(cy, SAFE_ROOM_SPACING) === offY;
}

export function isStairsChunk(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
): boolean {
  if (isSafeRoomChunk(worldSeed, floor, cx, cy)) return false;
  const layout = seedsFor(worldSeed, floor).layout;
  return hash2D(mixSeeds(layout, 0x57a1), cx, cy) % STAIRS_MODULUS === 0;
}

interface FeatureLayout {
  safeRoom: boolean;
  half: number;
  centerLx: number;
  centerLy: number;
  featureH: number;
}

/** Where the feature sits and how tall its flattened pad is (pure). */
function featureLayout(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  seeds: Seeds,
  segs: CorridorSegment[],
): FeatureLayout | null {
  const safeRoom = isSafeRoomChunk(worldSeed, floor, cx, cy);
  const stairs = isStairsChunk(worldSeed, floor, cx, cy);
  if (!safeRoom && !stairs) return null;

  const jitterRange = safeRoom ? 3 : 6;
  const jx = (hash2D(mixSeeds(seeds.layout, 0xf1a7), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const jy = (hash2D(mixSeeds(seeds.layout, 0xf1a8), cx, cy) % (jitterRange * 2 + 1)) - jitterRange;
  const centerLx = CHUNK_SIZE / 2 + jx;
  const centerLy = CHUNK_SIZE / 2 + jy;
  const featureH = baseSample(seeds, segs, cx * CHUNK_SIZE + centerLx, cy * CHUNK_SIZE + centerLy)
    .height;

  return { safeRoom, half: safeRoom ? SAFE_ROOM_HALF : 1, centerLx, centerLy, featureH };
}

/** Stamp the flattened pad and its height-blend apron into `tiles`/`height`. */
function stampFeaturePad(layout: FeatureLayout, tiles: Uint8Array, height: Float32Array): void {
  const { half, centerLx, centerLy, featureH } = layout;
  const margin = SAFE_ROOM_MARGIN;
  const reach = half + margin;
  for (let ly = centerLy - reach; ly <= centerLy + reach; ly++) {
    for (let lx = centerLx - reach; lx <= centerLx + reach; lx++) {
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      const d = Math.max(Math.abs(lx - centerLx), Math.abs(ly - centerLy));
      tiles[i] = TILE.Floor;
      if (d <= half) {
        // featureH samples terrain.ts's baseSample, which is height 0
        // everywhere by design (flat-first) — this pad is genuinely flat,
        // never Stairs-tagged. A Stairs tile with no real height delta
        // across its climb axis is the "flavor without height" bug the
        // worldgen redesign brief calls out: a tile flavored as a
        // staircase that ramps nothing. See world/stairs.ts's
        // entryClimbDir and stairsInvariant.test.ts, which assert every
        // TILE.Stairs tile has one.
        height[i] = featureH;
      } else {
        const t = smoothstep01((d - half) / margin);
        height[i] = featureH + ((height[i] ?? 0) - featureH) * t;
      }
    }
  }
}

/** Safe rooms and stairways: cleared, flattened, height-blended into terrain. */
export function applyFlattenedFeature(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  seeds: Seeds,
  segs: CorridorSegment[],
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
): void {
  void zones; // unused here; kept so this apply* function's signature matches its generate.ts call site
  const layout = featureLayout(worldSeed, floor, cx, cy, seeds, segs);
  if (!layout) return;

  stampFeaturePad(layout, tiles, height);

  if (layout.safeRoom) {
    // The safe room itself is an instanced stretch room (rooms.ts); the
    // overworld only gets its entrance: a raised kiosk TERRACE (walkable
    // floor, not a TILE.Wall rock mass — user-decreed 2026-07-19, see
    // VISUAL_DIRECTION.md's wall vertical-extent rule) whose south face
    // carries a portal door (GAME_DESIGN.md § Safe rooms).
    carveSafeRoomEntrance(tiles, height, layout.centerLx, layout.centerLy);
  }
}

/** Height of the kiosk terrace: z2, satisfying the generator's z+1 vertical-extent floor (docs/VISUAL_DIRECTION.md). */
export const KIOSK_HEIGHT = 2;

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
const TERRACE_TOP_ROWS = KIOSK_HEIGHT;
/** Rows from the door (exclusive) to the terrace's northmost row. */
const TERRACE_NORTH_REACH = KIOSK_HEIGHT + TERRACE_TOP_ROWS - 1;

/**
 * 5-wide x 5-deep kiosk TERRACE: a raised, walkable floor dais (not solid
 * rock) whose southernmost KIOSK_HEIGHT rows are its face, with
 * TERRACE_TOP_ROWS more of genuine flat top behind that at
 * EVERY column, door column included — never short a full z+1 of walkable
 * top the way a too-shallow terrace leaves the door's own column with
 * zero (docs/examples/user-kiosk-terrace-example.json is the hand-authored
 * acceptance fixture this shape matches). The door replaces the center
 * cell of the south face row AND drops that one cell to height 0 (flush
 * with the pad outside): STEP_UP gates grounded movement onto any raised
 * cell (movement/collision.ts's cornerBlocksMove), doors get no ramp/jump
 * exemption there, so a door left at the terrace's own height would be a
 * real portal nobody could ever walk up to — the doorway is a full-depth
 * notch cut down to the ground, same as any ordinary wall door, not a face
 * cell at reduced height.
 */
export function carveSafeRoomEntrance(
  tiles: Uint8Array,
  height: Float32Array,
  centerLx: number,
  centerLy: number,
): void {
  for (let dy = -TERRACE_NORTH_REACH; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const lx = centerLx + dx;
      const ly = centerLy + dy;
      if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
      const i = ly * CHUNK_SIZE + lx;
      tiles[i] = TILE.Floor;
      height[i] = KIOSK_HEIGHT;
    }
  }
  const doorLy = centerLy + 1;
  if (doorLy < CHUNK_SIZE) {
    const doorIndex = doorLy * CHUNK_SIZE + centerLx;
    tiles[doorIndex] = TILE.DoorSafeRoom;
    height[doorIndex] = KIOSK_HEIGHT;
  }
}
