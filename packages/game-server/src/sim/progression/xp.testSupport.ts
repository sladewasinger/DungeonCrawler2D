import {
  LEVEL, World, buildContentRegistry, createBody, hashString, makeEntity, newBrain, newEntityId,
  type EnemyDef, type RawContent,
} from "@dc2d/engine";
import { PlayerStore } from "../../store.js";
import { createSimState, type EnemySlot, type PlayerSlot, type SimState } from "../state/state.js";

const emptyContent: RawContent = { statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [] };

export const slimeDef: EnemyDef = {
  id: "slime", name: "Slime", tags: ["organic"], hp: 12, speed: 3, aggroRadius: 8,
  attack: { damage: 2, range: 0.9, cooldown: 1.2 }, drops: [], sprite: "slime", xp: 5,
  epithet: "dissolved by a slime. A slime.",
};

export function makeXpSim(store = new PlayerStore(null)): SimState {
  const world = new World(hashString("xp-test"), 1, LEVEL.Dungeon);
  const content = buildContentRegistry(emptyContent);
  const sim = createSimState({ world, content, store, rngSeed: 1, opts: {} });
  sim.tickCount = 100;
  return sim;
}

export function makeSlot(name: string, x: number, y: number): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, 0), {
    id: newEntityId("p"), name, hp: 10, maxHp: 10, tags: new Set(["player"]),
  });
  return {
    entity, clientId: `client-${name}`, stored: { slot: 0, name, stash: [], contacts: [], xp: 0, level: 1 },
    resumeToken: `token-${name}`, lastSeq: -1, pendingInputs: [], pendingActions: [], connected: true,
    reapAtTick: Number.MAX_SAFE_INTEGER, known: new Set<string>(), inventory: [], hotbar: [], weapon: null,
    outbox: [], returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: true,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: Number.NEGATIVE_INFINITY,
    god: false, forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

export function makeEnemySlot(x: number, y: number, def: EnemyDef): EnemySlot {
  const entity = makeEntity("enemy", createBody(x, y, 0), {
    id: newEntityId("e"), defId: def.id, name: def.name, hp: 0, maxHp: def.hp, tags: new Set(def.tags),
  });
  return { entity, brain: newBrain(), def, animation: { state: "idle", ticksRemaining: 0 } };
}
