import {
  TICK_DT,
  createBody,
  enemyThink,
  makeEntity,
  newBrain,
  stepBody,
  type EnemyDecision,
  type EnemyDef,
  type GridPathStep,
  type MoveInput,
  type WorldView,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { decideRememberedRouteSteering } from "../ai/rememberedRouteSteering.js";
const ENEMY: EnemyDef = {
  id: "memory-fixture",
  name: "Memory Fixture",
  tags: [],
  hp: 10,
  speed: 3,
  aggroRadius: 8,
  attack: { damage: 1, range: 0.5, cooldown: 1 },
  drops: [],
  sprite: "slime",
};
const LAST_SEEN = { x: 2.5, y: 0.5, z: 0 };
const FLAT_WALL_ROUTE: GridPathStep[] = [
  { x: 0.5, y: 1.5, jump: false },
  { x: 1.5, y: 1.5, jump: false },
  { x: 2.5, y: 1.5, jump: false },
  { x: 2.5, y: 0.5, jump: false },
];
const flatWallWorld: WorldView = {
  isWalkable: (x, y) =>
    !(Math.floor(x) === 1 && Math.floor(y) === 0),
  heightAt: () => 0,
  groundAt: () => 0,
  stairHeightAt: () => null,
};

interface SequenceTick {
  readonly thought: EnemyDecision;
  readonly move: MoveInput;
}

describe("remembered target lifecycle", () => {
  it("arrives at a last-seen point without reversing around a flat wall", () => {
    const sequence = flatWallSequence();
    const searchStart = sequence.findIndex(({ thought }) => thought.searching);
    expect(searchStart).toBeGreaterThan(0);
    expect(sequence[searchStart]?.move)
      .toEqual({ moveX: 0, moveY: 0, jump: false });
    const arrival = sequence.slice(0, searchStart + 1);
    expect(hasAlternatingSigns(arrival.map(({ move }) => move))).toBe(false);
  });
});

function flatWallSequence(): SequenceTick[] {
  const brain = newBrain();
  const enemy = makeEntity("enemy", createBody(0.5, 0.5, 0), {
    hp: 10,
    maxHp: 10,
  });
  const player = makeEntity("player", createBody(
    LAST_SEEN.x,
    LAST_SEEN.y,
    LAST_SEEN.z,
  ), { hp: 10, maxHp: 10 });
  rememberVisiblePlayer(brain, enemy, player);
  const route = [...FLAT_WALL_ROUTE];
  return Array.from({ length: 48 }, () => {
    consumeEnteredStep(enemy.body, route);
    const thought = hiddenTargetThought(brain, enemy);
    const move = rememberedMove(thought, enemy.body, route[0]);
    stepBody(flatWallWorld, enemy.body, move, TICK_DT, { speed: ENEMY.speed });
    return { thought, move };
  });
}

function rememberVisiblePlayer(
  brain: ReturnType<typeof newBrain>,
  enemy: ReturnType<typeof makeEntity>,
  player: ReturnType<typeof makeEntity>,
): void {
  enemyThink({
    brain,
    enemy,
    def: ENEMY,
    players: [player],
    inSanctuary: () => false,
    dt: TICK_DT,
    rng: () => 0.5,
    memorySeconds: 20,
  });
}

function hiddenTargetThought(
  brain: ReturnType<typeof newBrain>,
  enemy: ReturnType<typeof makeEntity>,
): EnemyDecision {
  return enemyThink({
    brain,
    enemy,
    def: ENEMY,
    players: [],
    inSanctuary: () => false,
    dt: TICK_DT,
    rng: () => 0.5,
    memorySeconds: 20,
    memorySearchSeconds: 1,
    memoryArrivalTolerance: ENEMY.speed * TICK_DT + 0.1,
  });
}

function rememberedMove(
  thought: EnemyDecision,
  body: ReturnType<typeof createBody>,
  step: GridPathStep | undefined,
): MoveInput {
  if (!thought.pursuit || !step) return thought.move;
  return decideRememberedRouteSteering({
    body,
    step,
    alignmentTolerance: 0.1,
  }).move;
}

function consumeEnteredStep(
  body: ReturnType<typeof createBody>,
  route: GridPathStep[],
): void {
  const step = route[0];
  if (!step) return;
  const entered = Math.floor(body.x) === Math.floor(step.x) &&
    Math.floor(body.y) === Math.floor(step.y);
  if (entered) route.shift();
}

function hasAlternatingSigns(moves: readonly MoveInput[]): boolean {
  return moves.some((move, index) => {
    const previous = moves[index - 1];
    return previous !== undefined &&
      (move.moveX * previous.moveX < 0 || move.moveY * previous.moveY < 0);
  });
}
