import {
  createBody,
  makeEntity,
  newBrain,
  newEntityId,
  type Entity,
} from "@dc2d/engine";
import { scaledEnemyDef } from "../floors/scaling.js";
import type { EnemySlot, SimState } from "../state/state.js";

/** Server-authoritative enemy construction with floor-scaled stats. */
export interface EnemySpawn {
  readonly defId: string;
  readonly x: number;
  readonly y: number;
  readonly home?: EnemySlot["home"];
  readonly arenaKey?: string;
  readonly arenaLeader?: true;
}

export function spawnEnemy(sim: SimState, spawn: EnemySpawn): Entity {
  const baseDef = sim.content.enemies.get(spawn.defId);
  if (!baseDef) throw new Error(`unknown enemy ${spawn.defId}`);
  const def = scaledEnemyDef(baseDef, sim.world.floor);
  const entity = createEnemyEntity(sim, spawn, def);
  sim.enemies.set(entity.id, createEnemySlot({
    entity,
    def,
    home: spawn.home,
    arenaKey: spawn.arenaKey,
    arenaLeader: spawn.arenaLeader,
  }));
  return entity;
}

function createEnemyEntity(
  sim: SimState,
  spawn: EnemySpawn,
  def: ReturnType<typeof scaledEnemyDef>,
): Entity {
  return makeEntity(
    "enemy",
    createBody(spawn.x, spawn.y, sim.world.groundAt(spawn.x, spawn.y)),
    {
      id: newEntityId("e"),
      defId: spawn.defId,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      baseSpeed: def.speed,
      tags: new Set(def.tags),
      facing: { x: 0, y: 1 },
    },
  );
}

interface EnemySlotInput {
  readonly entity: Entity;
  readonly def: ReturnType<typeof scaledEnemyDef>;
  readonly home: EnemySlot["home"] | undefined;
  readonly arenaKey: string | undefined;
  readonly arenaLeader: true | undefined;
}

function createEnemySlot(input: EnemySlotInput): EnemySlot {
  const { entity, def, home, arenaKey, arenaLeader } = input;
  return {
    entity,
    brain: newBrain(),
    def,
    rememberedRoute: null,
    ...(home ? { home } : {}),
    ...(arenaKey ? { arenaKey } : {}),
    ...(arenaLeader ? { arenaLeader } : {}),
    animation: { state: "idle", ticksRemaining: 0 },
  };
}
