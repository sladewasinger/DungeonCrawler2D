import { createBody, makeEntity, newBrain, newEntityId, type Entity } from "@dc2d/engine";
import type { SimState } from "./state";

/** Small queries and spawners shared across the sim modules. */

/** Every entity that can take damage or trigger effects. */
export function combatants(sim: SimState): Entity[] {
  const out: Entity[] = [];
  for (const slot of sim.players.values()) out.push(slot.entity);
  for (const enemy of sim.enemies.values()) out.push(enemy.entity);
  return out;
}

/** Per-entity effect modifiers (enemy immunities / damage scaling). */
export function effectTargetFor(sim: SimState, entity: Entity) {
  if (entity.kind === "enemy") {
    const def = sim.enemies.get(entity.id)?.def;
    return {
      ...(def?.immunities ? { immunities: def.immunities } : {}),
      ...(def?.damageScale ? { damageScale: def.damageScale } : {}),
    };
  }
  return {};
}

export function positionOf(sim: SimState, id: string): { x: number; y: number } {
  const entity =
    sim.players.get(id)?.entity ??
    sim.enemies.get(id)?.entity ??
    sim.items.get(id) ??
    sim.projectiles.get(id);
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

/** Spawn an enemy with a fresh brain. */
export function spawnEnemy(sim: SimState, defId: string, x: number, y: number): Entity {
  const def = sim.content.enemies.get(defId);
  if (!def) throw new Error(`unknown enemy ${defId}`);
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
    },
  );
  sim.enemies.set(entity.id, { entity, brain: newBrain(), def });
  return entity;
}
