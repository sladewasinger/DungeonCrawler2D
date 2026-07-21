import { CHASM_DEATH_Z, createBody, makeEntity, newBrain, newEntityId, type BodyState, type Entity } from "@dc2d/engine";
import { scaledEnemyDef } from "./floors/scaling.js";
import { isSpawnProtected } from "./spawnSafety.js";
import type { SimState } from "./state.js";

/** Small queries and spawners shared across the sim modules. */

/**
 * Design ruling: rifts are knockback death-pits, not inescapable holes. A
 * grounded body resting at or below chasm depth is standing in one —
 * whether it fell in, was knocked back into one, or walked down a ramp
 * that bottoms out there. Used by both players.ts and enemies/ai.ts so the
 * one ruling can't drift between them.
 */
export function isBodyInChasm(body: BodyState): boolean {
  return body.grounded && body.z <= CHASM_DEATH_Z;
}

/** Every entity that can take damage or trigger effects. */
export function combatants(sim: SimState): Entity[] {
  const out: Entity[] = [];
  for (const slot of sim.players.values()) out.push(slot.entity);
  for (const enemy of sim.enemies.values()) out.push(enemy.entity);
  return out;
}

/** Per-entity effect modifiers (enemy immunities / damage scaling,
 * player spawn-grace invulnerability). */
export function effectTargetFor(sim: SimState, entity: Entity) {
  if (entity.kind === "enemy") {
    const def = sim.enemies.get(entity.id)?.def;
    return {
      ...(def?.immunities ? { immunities: def.immunities } : {}),
      ...(def?.damageScale ? { damageScale: def.damageScale } : {}),
    };
  }
  const slot = sim.players.get(entity.id);
  if (slot && isSpawnProtected(slot, sim.tickCount)) return { invulnerable: true };
  return {};
}

export function positionOf(sim: SimState, id: string): { x: number; y: number } {
  const entity =
    sim.players.get(id)?.entity ??
    sim.enemies.get(id)?.entity ??
    sim.items.get(id) ??
    sim.projectiles.get(id) ??
    sim.torches.get(id);
  return entity ? { x: entity.body.x, y: entity.body.y } : { x: 0, y: 0 };
}

export function adjacentToTile(
  sim: SimState,
  tileX: number,
  tileY: number,
  tile: number,
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (sim.world.tileAt(tileX + dx, tileY + dy) === tile) return true;
    }
  }
  return false;
}

/** Spawn an item entity on the ground. */
export function spawnItem(sim: SimState, defId: string, x: number, y: number, qty = 1): Entity {
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
export function spawnEnemy(sim: SimState, defId: string, x: number, y: number): Entity {
  const baseDef = sim.content.enemies.get(defId);
  if (!baseDef) throw new Error(`unknown enemy ${defId}`);
  const def = scaledEnemyDef(baseDef, sim.world.floor);
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
  sim.enemies.set(entity.id, {
    entity,
    brain: newBrain(),
    def,
    animation: { state: "idle", ticksRemaining: 0 },
  });
  return entity;
}
