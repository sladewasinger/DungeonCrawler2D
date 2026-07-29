import {
  areasData,
  areaReactionsData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  ATTACK_COOLDOWN_MS,
  LEVEL,
  TICK_RATE,
  World,
  buildContentRegistry,
  hashString,
  type ClientInput,
  type ContentRegistry,
  type Entity,
  type GameEvent,
  type ServerSnapshot,
} from "@dc2d/engine";
import { GameSim } from "../core/index.js";
import { PlayerStore } from "../../store.js";
export { findSafeRoomDoor } from "./support/safeRoomSearch.js";
export { findFlatArena, findFlatFloor, nearbyAreaTile, type NearbyAreaSearch } from "./support/terrainSearch.js";

/**
 * Shared fixtures for the GameSim integration suite (sim/integration/):
 * headless multi-client tests that drive the exact sim the ws server
 * runs in production, minus the sockets. Files are split by domain to
 * respect the 150-line file cap. No coordinate here is a hardcoded
 * sandbox-chunk tile; everything is
 * either a relative offset from a live spawn/anchor or a deterministic
 * query against the running World.
 */

export const content: ContentRegistry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export const SEED = hashString("sim-test-world");
/** Ticks until the next melee swing is accepted (see sim/actions/melee.ts). */
export const SWING_TICKS = Math.round((ATTACK_COOLDOWN_MS / 1000) * TICK_RATE);

export function makeSim(rngSeed = 1234, opts: { testFixtures?: boolean; debugCommands?: boolean; freezeEnemies?: boolean; torchBurnTicks?: number } = { testFixtures: true }): GameSim {
  return new GameSim({ world: new World(SEED, 1, LEVEL.Sandbox), content: content, store: new PlayerStore(null), rngSeed: rngSeed, opts: opts });
}

export interface InputFixture {
  seq: number;
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  jump?: boolean;
  run?: boolean;
  projectedServerTick?: number;
}

export function input({
  seq,
  moveX,
  moveY,
  jump = false,
  run = false,
  projectedServerTick = 0,
}: InputFixture): ClientInput {
  return { type: "input", seq, projectedServerTick, moveX, moveY, jump, run };
}

/** Force-place an entity, resetting fall tracking as if it just landed there. */
export interface TeleportFixture {
  entity: Entity;
  x: number;
  y: number;
  sim: GameSim;
}

export function teleport({ entity, x, y, sim }: TeleportFixture): void {
  entity.body.x = x;
  entity.body.y = y;
  entity.body.z = sim.world.groundAt(x, y);
  entity.body.grounded = true;
  entity.body.fallStart = entity.body.z;
}

export function stepN(sim: GameSim, n: number): Map<string, ServerSnapshot> {
  let out = new Map<string, ServerSnapshot>();
  for (let i = 0; i < n; i++) out = sim.step();
  return out;
}

export function eventsOf(snapshots: Map<string, ServerSnapshot>, id: string): GameEvent[] {
  return snapshots.get(id)?.events ?? [];
}

/** Two players, already partied (A invites, B accepts, one tick apart). */
export function makeParty(sim: GameSim): { aId: string; bId: string } {
  const a = sim.addPlayer({ name: "A", clientId: "client-a" });
  const b = sim.addPlayer({ name: "B", clientId: "client-b" });
  teleport({ entity: sim.getPlayerEntity(b.playerId)!, x: a.spawn.x + 2, y: a.spawn.y, sim: sim });
  sim.queueAction(a.playerId, { type: "party", op: "invite", target: b.playerId });
  sim.step();
  sim.queueAction(b.playerId, { type: "party", op: "accept" });
  sim.step();
  return { aId: a.playerId, bId: b.playerId };
}
