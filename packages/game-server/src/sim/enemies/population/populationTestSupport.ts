import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  buildContentRegistry,
  createBody,
  hashString,
  LEVEL,
  makeEntity,
  World,
  type LevelId,
} from "@dc2d/engine";
import { PlayerStore } from "../../../store.js";
import {
  createSimState,
  type PlayerSlot,
  type SimState,
} from "../../state/state.js";

const CONTENT = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

interface PopulationTestSim {
  readonly floor?: number;
  readonly level?: LevelId;
  readonly rngSeed?: number;
}

export function createPopulationTestSim(
  options: PopulationTestSim = {},
): SimState {
  const floor = options.floor ?? 1;
  const level = options.level ?? LEVEL.Dungeon;
  const world = new World(hashString("population-test-world"), floor, level);
  return createSimState({
    world,
    content: CONTENT,
    store: new PlayerStore(null),
    rngSeed: options.rngSeed ?? 42,
    opts: {},
  });
}

export function addPopulationTestPlayer(
  sim: SimState,
  position: { x: number; y: number },
): void {
  sim.players.set("p1", makeSlot(sim, position));
}

interface PopulationCount {
  readonly sim: SimState;
  readonly anchor: { x: number; y: number };
  readonly radius: number;
  readonly ordinaryOnly?: boolean;
}

export function countPopulation(input: PopulationCount): number {
  let count = 0;
  for (const enemy of input.sim.enemies.values()) {
    if (input.ordinaryOnly && (enemy.arenaKey || enemy.entity.hp <= 0)) continue;
    if (distanceFrom(enemy.entity.body, input.anchor) <= input.radius) count++;
  }
  return count;
}

export function ordinaryTypeCounts(input: PopulationCount): Map<string, number> {
  const counts = new Map<string, number>();
  for (const enemy of input.sim.enemies.values()) {
    if (enemy.arenaKey || enemy.entity.hp <= 0) continue;
    if (distanceFrom(enemy.entity.body, input.anchor) > input.radius) continue;
    counts.set(enemy.def.id, (counts.get(enemy.def.id) ?? 0) + 1);
  }
  return counts;
}

function makeSlot(
  sim: SimState,
  position: { x: number; y: number },
): PlayerSlot {
  const entity = makeEntity(
    "player",
    createBody(position.x, position.y, sim.world.groundAt(position.x, position.y)),
    { id: "p1", hp: 30, maxHp: 30, baseSpeed: 8 },
  );
  return {
    entity,
    clientId: "c1",
    stored: { slot: 0, name: "tester", stash: [], contacts: [] },
    resumeToken: "tok",
    ...emptyPlayerRuntimeState(),
  };
}

function emptyPlayerRuntimeState(): Omit<
  PlayerSlot,
  "entity" | "clientId" | "stored" | "resumeToken"
> {
  return {
    lastSeq: 0,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: 0,
    known: new Set<string>(),
    inventory: [],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: true,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: -1000,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0,
    pendingTransfer: null,
  };
}

function distanceFrom(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
