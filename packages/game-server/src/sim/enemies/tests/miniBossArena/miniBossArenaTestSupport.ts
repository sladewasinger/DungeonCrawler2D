import {
  buildContentRegistry,
  createBody,
  hashString,
  makeEntity,
  type MiniBossArenaGate,
  type MiniBossArenaSite,
} from "@dc2d/engine";
import {
  areaReactionsData,
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { PlayerStore } from "../../../../store.js";
import {
  createSimState,
  type PlayerSlot,
  type SimState,
} from "../../../state/state.js";
import { createPlayerSlot } from "../../../players/joinSlot.js";
import { stepMiniBossArenaBoundaries } from "../../miniBossArena/boundary.js";
import {
  handleMiniBossEnemyDeath,
  spawnMiniBossEncounter,
} from "../../miniBossArena/population.js";
import { miniBossEncounterForArena } from "../../miniBossArena/encounterComposition.js";
import { miniBossArenaEntryForPlayer } from "../../miniBossArena/runtime.js";
import { finiteServerWorldFixture } from "../../../testing/finiteWorldTestSupport.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  areaReactions: [...areaReactionsData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

export function createMiniBossArenaSim(): SimState {
  const seed = hashString("mini-boss-gate");
  return createSimState({
    world: finiteServerWorldFixture(1, seed),
    content,
    store: new PlayerStore(null),
    rngSeed: seed,
    opts: {},
  });
}

export function spawnTestArena(sim: SimState): MiniBossArenaSite {
  for (const arena of orderedArenaFixtures(sim)) {
    const spawned = spawnArena(sim, arena);
    if (spawned) return arena;
  }
  throw new Error("test seed produced no mini-boss arena");
}

function orderedArenaFixtures(sim: SimState): readonly MiniBossArenaSite[] {
  return [...(sim.world.generatedFloor?.miniBossArenas ?? [])]
    .filter((arena) =>
      Math.abs(arena.chunk.cx) <= 10 && Math.abs(arena.chunk.cy) <= 10
    )
    .sort((left, right) =>
      left.chunk.cy - right.chunk.cy || left.chunk.cx - right.chunk.cx
    );
}

export function addArenaPlayer(
  sim: SimState,
  id: string,
  position: { readonly x: number; readonly y: number },
): PlayerSlot {
  const entity = makeEntity(
    "player",
    createBody(position.x, position.y, 0),
    { id, name: id, hp: 30, maxHp: 30 },
  );
  const slot = createPlayerSlot({
    entity,
    clientId: `client-${id}`,
    stored: sim.store.get(`client-${id}`, id),
    resumeToken: `token-${id}`,
    tick: sim.tickCount,
  });
  sim.players.set(id, slot);
  return slot;
}

function spawnArena(
  sim: SimState,
  candidate: MiniBossArenaSite,
): boolean {
  if (miniBossEncounterForArena({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    arena: candidate,
  }).id !== "orc-warlord") return false;
  return spawnMiniBossEncounter(
    sim,
    candidate.chunk.cx,
    candidate.chunk.cy,
  );
}

export function requiredArenaGate(
  gate: MiniBossArenaGate | undefined,
): MiniBossArenaGate {
  if (!gate) throw new Error("arena has no gate");
  return gate;
}

export function arenaEntryDirection(
  gate: MiniBossArenaGate,
): { readonly x: number; readonly y: number } {
  const dx = gate.inside.x - gate.outside.x;
  const dy = gate.inside.y - gate.outside.y;
  const distance = Math.hypot(dx, dy);
  return { x: dx / distance, y: dy / distance };
}

export function advanceTestArenaEntry(
  sim: SimState,
  slot: PlayerSlot,
): Array<{ readonly x: number; readonly y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let tick = 0; tick < 40; tick++) {
    if (!miniBossArenaEntryForPlayer(sim, slot.entity.id)) break;
    stepMiniBossArenaBoundaries(sim);
    positions.push({ x: slot.entity.body.x, y: slot.entity.body.y });
  }
  return positions;
}

export function defeatTestArenaBoss(
  sim: SimState,
  arenaKey: string,
): void {
  const boss = [...sim.enemies.entries()].find(([, enemy]) =>
    enemy.arenaKey === arenaKey && enemy.arenaLeader
  );
  if (!boss) throw new Error("test arena has no leader");
  const [id, enemy] = boss;
  sim.enemies.delete(id);
  handleMiniBossEnemyDeath(sim, enemy);
}
