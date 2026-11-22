/** Detects stamped Bandit Camps and Ancient Ruins in a chunk and populates guards, campfires, and chests. */
import { CHUNK_SIZE, TILE, createBody, makeEntity, newEntityId, type InvStack } from "@dc2d/engine";
import { spawnEnemy } from "../../core/helpers.js";
import { spawnWildLootChest } from "../../lootChests/lootChests.js";
import type { SimState } from "../../state/state.js";
import { canAddNearSpawnEnemies, isInsideSpawnEnemyExclusion, isNearSpawnPopulationPosition } from "./nearSpawn.js";

const ENEMY_CAP = 150;
const CAMP_GUARDS = ["goblin", "masked-orc", "orc-warrior", "orc-shaman"] as const;
const RUIN_GUARDS = ["skeleton", "tiny-zombie", "big-zombie", "fallen-angel", "wogol", "pumpkin-fiend"] as const;

interface LandmarkDetection {
  readonly kind: "camp" | "ruin";
  readonly center: { readonly x: number; readonly y: number };
}

export function populateChunkLandmarks(sim: SimState, cx: number, cy: number): boolean {
  const landmark = detectChunkLandmark(sim, cx, cy);
  if (!landmark) return false;
  placeLandmarkCampfire(sim, landmark.center);
  placeLandmarkChest(sim, landmark);
  spawnLandmarkGuards(sim, landmark);
  return true;
}

function detectChunkLandmark(sim: SimState, cx: number, cy: number): LandmarkDetection | null {
  const campBounds = featureBoundingBox({ sim, cx, cy, match: (t) => t === TILE.CampFence || t === TILE.CampTent });
  if (campBounds) return { kind: "camp", center: boxCenter(campBounds) };
  const ruinBounds = featureBoundingBox({ sim, cx, cy, match: (t) => t === TILE.RuinPillar });
  if (ruinBounds) return { kind: "ruin", center: boxCenter(ruinBounds) };
  return null;
}

interface TileBox { minX: number; maxX: number; minY: number; maxY: number; }

function featureBoundingBox(input: {
  readonly sim: SimState;
  readonly cx: number;
  readonly cy: number;
  readonly match: (tile: number) => boolean;
}): TileBox | null {
  const { sim, cx, cy, match } = input;
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  let box: TileBox | null = null;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      const wy = baseY + ly;
      const tile = sim.world.featureAt?.(wx, wy) ?? sim.world.tileAt(wx, wy);
      if (match(tile)) box = expandBox(box, wx, wy);
    }
  }
  return box;
}

function expandBox(box: TileBox | null, x: number, y: number): TileBox {
  if (!box) return { minX: x, maxX: x, minY: y, maxY: y };
  return {
    minX: Math.min(box.minX, x),
    maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y),
    maxY: Math.max(box.maxY, y),
  };
}

function boxCenter(box: TileBox): { x: number; y: number } {
  return { x: Math.round((box.minX + box.maxX) / 2), y: Math.round((box.minY + box.maxY) / 2) };
}

function placeLandmarkCampfire(sim: SimState, center: { readonly x: number; readonly y: number }): void {
  const x = center.x + 0.5;
  const y = center.y + 0.5;
  const campfire = makeEntity("torch", createBody(x, y, sim.world.groundAt(x, y)), {
    id: newEntityId("t"),
    defId: "torch",
    torchState: "placed",
    expiresAtTick: Number.MAX_SAFE_INTEGER,
  });
  sim.torches.set(campfire.id, campfire);
}

function placeLandmarkChest(sim: SimState, landmark: LandmarkDetection): void {
  const spots = walkableCourtyardTiles(sim, landmark.center, true);
  const spot = spots[0] ?? landmark.center;
  const x = spot.x + 0.5;
  const y = spot.y + 0.5;
  spawnWildLootChest(sim, {
    x,
    y,
    z: sim.world.groundAt(x, y),
    label: landmark.kind === "camp" ? "Bandit Camp Chest" : "Ancient Ruin Chest",
    slots: landmarkChestLoot(sim, landmark.kind),
  });
}

function spawnLandmarkGuards(sim: SimState, landmark: LandmarkDetection): void {
  const roster = landmark.kind === "camp" ? CAMP_GUARDS : RUIN_GUARDS;
  const spots = walkableCourtyardTiles(sim, landmark.center, false);
  const desiredCount = 3 + Math.floor(sim.rng.next() * 2);
  for (let i = 0; i < desiredCount && spots.length > 0 && sim.enemies.size < ENEMY_CAP; i++) {
    const pickIdx = Math.floor(sim.rng.next() * spots.length);
    const [spot] = spots.splice(pickIdx, 1);
    if (!spot) continue;
    const defId = roster[Math.floor(sim.rng.next() * roster.length)]!;
    spawnGuardIfAllowed(sim, defId, { x: spot.x + 0.5, y: spot.y + 0.5 });
  }
}

function spawnGuardIfAllowed(sim: SimState, defId: string, pos: { x: number; y: number }): void {
  if (isInsideSpawnEnemyExclusion(sim, pos)) return;
  if (isNearSpawnPopulationPosition(sim, pos) && !canAddNearSpawnEnemies(sim, [defId])) return;
  spawnEnemy(sim, { defId, x: pos.x, y: pos.y });
}

function walkableCourtyardTiles(
  sim: SimState,
  center: { readonly x: number; readonly y: number },
  adjacentOnly: boolean,
): Array<{ x: number; y: number }> {
  const radius = adjacentOnly ? 1 : 2;
  const out: Array<{ x: number; y: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    collectWalkableRow({ sim, center, radius, dy, out });
  }
  return out;
}

function collectWalkableRow(ctx: {
  readonly sim: SimState;
  readonly center: { readonly x: number; readonly y: number };
  readonly radius: number;
  readonly dy: number;
  readonly out: Array<{ x: number; y: number }>;
}): void {
  const { sim, center, radius, dy, out } = ctx;
  for (let dx = -radius; dx <= radius; dx++) {
    if (dx === 0 && dy === 0) continue;
    const tx = center.x + dx;
    const ty = center.y + dy;
    if (sim.world.isWalkable(tx, ty)) out.push({ x: tx, y: ty });
  }
}

function landmarkChestLoot(sim: SimState, kind: LandmarkDetection["kind"]): InvStack[] {
  const base: InvStack[] = kind === "camp"
    ? [{ item: "arrow", qty: 8 }, { item: "cooked-meat", qty: 2 }, { item: "bandage", qty: 2 }, { item: "flint", qty: 2 }]
    : [{ item: "bandage", qty: 3 }, { item: "water-flask", qty: 2 }, { item: "arrow", qty: 8 }, { item: "flint", qty: 3 }];
  const bonus = kind === "camp"
    ? [{ item: "bow", qty: 1 }, { item: "wolf-pelt", qty: 2 }, { item: "spider-silk", qty: 2 }]
    : [{ item: "sword", qty: 1 }, { item: "bow", qty: 1 }, { item: "bear-hide", qty: 2 }];
  return [...base, bonus[Math.floor(sim.rng.next() * bonus.length)]!];
}
