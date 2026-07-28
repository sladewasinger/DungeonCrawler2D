import {
  CHASM_DEATH_Z,
  TERRAIN,
  createBody,
  makeEntity,
  newBrain,
  newEntityId,
  type BodyState,
  type Entity,
} from "@dc2d/engine";
import { scaledEnemyDef } from "../floors/scaling.js";
import { isSpawnProtected } from "../spawnSafety/spawnSafety.js";
import {
  GOD_MODE_DAMAGE_MULTIPLIER,
  handicapForPlayer,
  type HandicapGrant,
} from "../progression/handicap.js";
import type { EnemySlot, PlayerSlot, SimState } from "../state/state.js";

/** Small queries and spawners shared across the sim modules. */

/**
 * A grounded body whose base terrain is explicitly void is standing in a void — with
 * the old negative-z check retained for legacy/teleported bodies. Used by
 * players.ts and enemies/ai.ts so the death ruling cannot drift.
 */
export function isBodyInChasm(
  world: { terrainAt(x: number, y: number): number },
  body: BodyState,
): boolean {
  return body.grounded && (
    world.terrainAt(Math.floor(body.x), Math.floor(body.y)) === TERRAIN.Void ||
    body.z <= CHASM_DEATH_Z
  );
}

/** Every entity that can take damage or trigger effects. */
export function combatants(sim: SimState): Entity[] {
  const out: Entity[] = [];
  for (const slot of sim.players.values()) if (slot.connected) out.push(slot.entity);
  for (const enemy of sim.enemies.values()) out.push(enemy.entity);
  return out;
}

/** Per-entity effect modifiers (enemy scaling, player spawn-grace,
 * and player handicap damage reduction). */
export function effectTargetFor(
  sim: SimState,
  entity: Entity,
  options: { spawnProtection?: boolean } = {},
) {
  if (entity.kind === "enemy") return enemyEffectTarget(sim, entity.id);
  return playerEffectTarget(sim, sim.players.get(entity.id), options);
}

function enemyEffectTarget(sim: SimState, id: string) {
  const def = sim.enemies.get(id)?.def;
  return {
    ...(def?.immunities ? { immunities: def.immunities } : {}),
    ...(def?.damageScale ? { damageScale: def.damageScale } : {}),
  };
}

function playerEffectTarget(
  sim: SimState,
  slot: PlayerSlot | undefined,
  options: { spawnProtection?: boolean },
) {
  if (!slot) return {};
  if (options.spawnProtection !== false && isSpawnProtected(slot, sim.tickCount)) {
    return { invulnerable: true };
  }
  const handicap = playerHandicap(slot);
  return handicap ? { damageTakenMultiplier: handicap.damageTakenMultiplier } : {};
}

/** Returns the active grant for a player, including future admin grants. */
export function damageGivenMultiplierFor(sim: SimState, entity: Entity): number {
  if (entity.kind !== "player") return 1;
  const slot = sim.players.get(entity.id);
  const handicapMultiplier = playerHandicap(slot)?.damageGivenMultiplier ?? 1;
  const godMultiplier = slot?.god ? GOD_MODE_DAMAGE_MULTIPLIER : 1;
  return handicapMultiplier * godMultiplier;
}

function playerHandicap(slot: PlayerSlot | undefined): HandicapGrant | undefined {
  return slot?.handicap ?? (slot
    ? handicapForPlayer(slot.entity.name ?? "", slot.stored.handicapGranted)
    : undefined);
}

export function positionOf(sim: SimState, id: string): { x: number; y: number } {
  const entity = [
    sim.players.get(id)?.entity, sim.enemies.get(id)?.entity, sim.pets.get(id)?.entity,
    sim.items.get(id), sim.lootChests.get(id)?.entity, sim.projectiles.get(id), sim.torches.get(id),
  ].find((candidate): candidate is Entity => candidate !== undefined);
  return entity ? { x: entity.body.x, y: entity.body.y } : { x: 0, y: 0 };
}

/** Spawn an item entity on the ground. */
export interface ItemSpawn {
  defId: string;
  x: number;
  y: number;
  qty?: number;
}

export function spawnItem(sim: SimState, spawn: ItemSpawn): Entity {
  const { defId, x, y, qty = 1 } = spawn;
  const item = makeEntity(
    "item",
    createBody(x, y, sim.world.groundAt(x, y)),
    {
      id: newEntityId("i"),
      defId,
      qty,
      tags: new Set(sim.content.items.get(defId)?.tags ?? []),
    },
  );
  sim.items.set(item.id, item);
  return item;
}

/** Spawn an enemy with a fresh brain. Stats scale with the sim's floor
 * (Epic 7.14) — see floors/scaling.ts; floor 1 is unscaled. */
export interface EnemySpawn {
  defId: string;
  x: number;
  y: number;
  home?: EnemySlot["home"];
}

export function spawnEnemy(sim: SimState, spawn: EnemySpawn): Entity {
  const { defId } = spawn;
  const baseDef = sim.content.enemies.get(defId);
  if (!baseDef) throw new Error(`unknown enemy ${defId}`);
  const def = scaledEnemyDef(baseDef, sim.world.floor);
  const entity = createEnemyEntity(sim, spawn, def);
  sim.enemies.set(entity.id, enemySlot(entity, def, spawn.home));
  return entity;
}

function createEnemyEntity(sim: SimState, spawn: EnemySpawn, def: ReturnType<typeof scaledEnemyDef>): Entity {
  const { x, y, defId } = spawn;
  const entity = makeEntity(
    "enemy",
    createBody(x, y, sim.world.groundAt(x, y)),
    {
      id: newEntityId("e"),
      defId,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      baseSpeed: def.speed,
      tags: new Set(def.tags),
      facing: { x: 0, y: 1 },
    },
  );
  return entity;
}

function enemySlot(entity: Entity, def: ReturnType<typeof scaledEnemyDef>, home: EnemySlot["home"] | undefined): EnemySlot {
  return {
    entity,
    brain: newBrain(),
    def,
    ...(home ? { home } : {}),
    animation: { state: "idle", ticksRemaining: 0 },
  };
}
