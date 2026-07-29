import {
  LEVEL,
  World,
  type ClientInput,
  type ClientMessage,
  type MoveInput,
  type ServerSnapshot,
} from "@dc2d/engine";
import { vi } from "vitest";
import { applySnapshot } from "../../packages/client/src/net/sync/apply.js";
import { Connection } from "../../packages/client/src/net/connection/connection.js";
import {
  findFlatArena,
  makeSim,
  teleport,
} from "../../packages/game-server/src/sim/integration/support.js";

type Sim = ReturnType<typeof makeSim>;

export interface PredictionContext {
  sim: Sim;
  playerId: string;
  serverPlayer: NonNullable<ReturnType<Sim["getPlayerEntity"]>>;
  arena: { x: number; y: number };
  connection: Connection;
}

interface PredictionSetupOptions {
  seed: number;
  name: string;
  clientId: string;
  testFixtures?: boolean;
  warmupTicks?: number;
}

export function createPredictionContext(options: PredictionSetupOptions): PredictionContext {
  const sim = makeSim(options.seed, { freezeEnemies: true, testFixtures: options.testFixtures });
  for (let tick = 0; tick < (options.warmupTicks ?? 0); tick++) sim.step();
  const joined = sim.addPlayer({ name: options.name, clientId: options.clientId });
  const serverPlayer = prepareServerPlayer(sim, joined.playerId, joined.spawn);
  const connection = createConnection(sim, options);
  applyInitialSnapshot(sim, joined.playerId, connection);
  return { sim, playerId: joined.playerId, serverPlayer, arena: findFlatArena({ sim, anchor: { x: joined.spawn.x, y: joined.spawn.y } }), connection };
}

function prepareServerPlayer(
  sim: Sim,
  playerId: string,
  spawn: { x: number; y: number },
): NonNullable<ReturnType<Sim["getPlayerEntity"]>> {
  const serverPlayer = sim.getPlayerEntity(playerId);
  if (!serverPlayer) throw new Error("expected joined server player");
  const arena = findFlatArena({ sim, anchor: { x: spawn.x, y: spawn.y } });
  teleport({ entity: serverPlayer, x: arena.x, y: arena.y, sim });
  return serverPlayer;
}

function createConnection(sim: Sim, options: PredictionSetupOptions): Connection {
  const connection = new Connection("ws://integration.test", options.name, options.clientId);
  connection.status = "connected";
  connection.world = new World(sim.world.worldSeed, sim.world.floor, LEVEL.Sandbox);
  return connection;
}

function applyInitialSnapshot(sim: Sim, playerId: string, connection: Connection): void {
  const initial = sim.step().get(playerId);
  if (!initial) throw new Error("expected initial authoritative snapshot");
  applySnapshot(connection, initial);
}

export function sendInputsDirectly(context: PredictionContext): void {
  vi.spyOn(context.connection, "send").mockImplementation((message: ClientMessage) => {
    if (message.type === "input") context.sim.handleInput(context.playerId, message);
  });
}

export function applyStep(context: PredictionContext): void {
  const snapshot = context.sim.step().get(context.playerId);
  if (snapshot) applySnapshot(context.connection, snapshot);
}

export function applyReplicatedStep(context: PredictionContext): ServerSnapshot | undefined {
  const snapshot = context.sim.stepReplicated().get(context.playerId);
  return snapshot?.type === "snapshot" ? snapshot : undefined;
}

export interface DelayedInputOptions {
  context: PredictionContext;
  delayedInputs: Map<number, ClientInput[]>;
  delayedSnapshots: Map<number, ServerSnapshot>;
  heldInput: MoveInput;
  idleInput: MoveInput;
}

export function runDelayedInputMovement(options: DelayedInputOptions): void {
  for (let wallTick = 1; wallTick <= 100; wallTick++) runDelayedInputTick(options, wallTick);
  options.delayedSnapshots.clear();
  drainDelayedSnapshots(options);
}

function runDelayedInputTick(options: DelayedInputOptions, wallTick: number): void {
  const input = wallTick <= 25 ? options.heldInput : options.idleInput;
  if (wallTick === 26) options.context.connection.sendInputEdge(input);
  options.context.connection.sampleInput(input);
  queueDelayedSnapshot(options, wallTick);
  applyDelayedSnapshot(options, wallTick);
}

function queueDelayedSnapshot(options: DelayedInputOptions, wallTick: number): void {
  const snapshot = stepDelayedServer(options);
  if (snapshot) options.delayedSnapshots.set(wallTick + 2, snapshot);
}

function applyDelayedSnapshot(options: DelayedInputOptions, wallTick: number): void {
  const snapshot = options.delayedSnapshots.get(wallTick);
  if (snapshot) applySnapshot(options.context.connection, snapshot);
  options.delayedSnapshots.delete(wallTick);
}

function drainDelayedSnapshots(options: DelayedInputOptions): void {
  for (let tick = 0; tick < 6; tick++) {
    const snapshot = stepDelayedServer(options);
    if (snapshot) applySnapshot(options.context.connection, snapshot);
  }
}

function stepDelayedServer(options: DelayedInputOptions): ServerSnapshot | undefined {
  for (const message of options.delayedInputs.get(options.context.sim.tick) ?? []) {
    options.context.sim.handleInput(options.context.playerId, message);
  }
  options.delayedInputs.delete(options.context.sim.tick);
  return applyReplicatedStep(options.context);
}
