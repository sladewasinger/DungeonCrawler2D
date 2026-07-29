import type { EnemySlot, PlayerSlot, SimState } from "../../../state/state.js";
import { useMiniBossArenaGate } from "../../miniBossArena/gate.js";
import {
  addArenaPlayer,
  advanceTestArenaEntry,
  createMiniBossArenaSim,
  requiredArenaGate,
  spawnTestArena,
} from "./miniBossArenaTestSupport.js";

export const ORC_WARRIOR = "orc-warrior";
export const ORC_SHAMAN = "orc-shaman";
export const ORC_WARLORD = "orc-warlord";
export const MASKED_ORC = "masked-orc";
export const ARENA_ENEMY_TYPES = [
  ORC_WARLORD,
  ORC_WARRIOR,
  ORC_SHAMAN,
  MASKED_ORC,
] as const;

export interface ArenaAggroFixture {
  readonly sim: SimState;
  readonly arena: ReturnType<typeof spawnTestArena>;
  readonly player: PlayerSlot;
  readonly enemy: EnemySlot;
}

export function arenaFixture(
  defId: typeof ARENA_ENEMY_TYPES[number],
): ArenaAggroFixture {
  const sim = createMiniBossArenaSim();
  const arena = spawnTestArena(sim);
  const gate = requiredArenaGate(arena.gates[0]);
  const player = addArenaPlayer(sim, "fighter", gate.outside);
  const enemy = retainArenaEnemy(sim, defId);
  useMiniBossArenaGate({ sim, slot: player, gate });
  return { sim, arena, player, enemy };
}

export function admittedArenaFixture(
  defId: typeof ARENA_ENEMY_TYPES[number],
): ArenaAggroFixture {
  const fixture = arenaFixture(defId);
  advanceTestArenaEntry(fixture.sim, fixture.player);
  const center = fixture.arena.center;
  fixture.player.entity.body.x = center.x + 0.5;
  fixture.player.entity.body.y = center.y + 0.5;
  return fixture;
}

function retainArenaEnemy(
  sim: SimState,
  defId: typeof ARENA_ENEMY_TYPES[number],
): EnemySlot {
  const selected = [...sim.enemies.values()].find((enemy) =>
    enemy.def.id === defId
  );
  if (!selected) throw new Error(`missing arena enemy ${defId}`);
  for (const [id, enemy] of sim.enemies) {
    if (enemy !== selected) sim.enemies.delete(id);
  }
  return selected;
}

interface EnemyPlacement extends ArenaAggroFixture {
  readonly distance: number;
}

export function placeEnemyBesidePlayer(input: EnemyPlacement): void {
  const { sim, enemy, player, distance } = input;
  enemy.entity.body.x = player.entity.body.x + distance;
  enemy.entity.body.y = player.entity.body.y;
  enemy.entity.body.z = sim.world.groundAt(
    enemy.entity.body.x,
    enemy.entity.body.y,
  );
}

export function primeOutsideWindup(
  enemy: EnemySlot,
  player: PlayerSlot,
): void {
  const target = {
    targetId: player.entity.id,
    x: player.entity.body.x,
    y: player.entity.body.y,
    z: player.entity.body.z,
  };
  enemy.brain.targetId = player.entity.id;
  enemy.brain.rememberedTarget = target;
  enemy.brain.memorySecondsRemaining = 10;
  enemy.brain.memoryPhase = "searching";
  enemy.brain.memorySearchSecondsRemaining = 10;
  enemy.rememberedRoute = {
    targetId: player.entity.id,
    goalTileX: Math.floor(target.x),
    goalTileY: Math.floor(target.y),
    steps: [],
  };
  enemy.animation = { state: "windup", ticksRemaining: 1, target };
  enemy.entity.body.kx = 2;
  enemy.entity.body.ky = -2;
}
