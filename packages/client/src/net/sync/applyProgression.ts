import { World, type GeneratedFloor, type ServerSnapshot } from "@dc2d/engine";
import type { Connection } from "../connection/connection.js";
import { createFiniteWorldRunner, type FiniteWorldRunner } from "../connection/finiteWorld/finiteWorldRunner.js";
import { floorChangeEvents } from "../events/floorEvents.js";
import { xpGainEvents } from "../events/xpEvents.js";
import { applySnapshot } from "./apply.js";

interface ProgressionState {
  readonly xp: number;
  readonly level: number;
  readonly xpForNext: number;
}

export function applySnapshotProgression(conn: Connection, snap: ServerSnapshot): void {
  applyXpState(conn, progressionFrom(conn, snap));
  applyFloorState(conn, snap);
}

function progressionFrom(conn: Connection, snap: ServerSnapshot): ProgressionState {
  return {
    xp: snap.self.xp ?? conn.xp,
    level: snap.self.level ?? conn.charLevel,
    xpForNext: snap.self.xpForNext ?? conn.xpForNext,
  };
}

function applyXpState(conn: Connection, next: ProgressionState): void {
  if (conn.hasReceivedSnapshot) {
    conn.visualEvents.push(...xpGainEvents(
      { xp: conn.xp, level: conn.charLevel },
      { xp: next.xp, level: next.level },
    ));
  }
  conn.xp = next.xp;
  conn.charLevel = next.level;
  conn.xpForNext = next.xpForNext;
}

function applyFloorState(conn: Connection, snap: ServerSnapshot): void {
  const next = snap.self.floor ?? conn.welcome?.floor ?? conn.floor;
  if (next === conn.floor) assertCurrentGeneration(conn, snap);
  if (conn.hasReceivedSnapshot) conn.visualEvents.push(...floorChangeEvents(conn.floor, next));
  if (next !== conn.floor) replaceFloorWorld(conn, snap, next);
  conn.floor = next;
}

function replaceFloorWorld(conn: Connection, snap: ServerSnapshot, next: number): void {
  if (!conn.world) return;
  const generation = snap.self.generation;
  if (!generation) throw new Error("Floor transfer missing destination generation identity");
  const currentWorld = conn.world;
  conn.worldLoadCancel?.();
  conn.worldLoadCancel = null;
  conn.worldLoadAttempt++;
  const loadAttempt = conn.worldLoadAttempt;
  const runner = createFiniteWorldRunner();
  const job = runner.request({
    worldSeed: currentWorld.worldSeed,
    floor: next,
    features: currentWorld.features,
    ...(snap.self.finiteFloorArtifact ? { finiteFloorArtifact: snap.self.finiteFloorArtifact } : {}),
  });
  conn.world = null;
  conn.worldReady = false;
  conn.worldLoading = true;
  conn.worldLoadError = null;
  conn.onWorldLoading?.();
  conn.worldLoadCancel = () => { job.cancel(); runner.dispose(); };
  void job.promise.then((generatedFloor) => completeFloorWorldLoad({
    conn, currentWorld, next, generation, runner, generatedFloor, loadAttempt,
  }))
    .catch((error: unknown) => failFloorWorldLoad({ conn, next, runner, error, loadAttempt }));
}

function completeFloorWorldLoad(input: {
  readonly conn: Connection; readonly currentWorld: World; readonly next: number;
  readonly generation: NonNullable<ServerSnapshot["self"]["generation"]>;
  readonly runner: FiniteWorldRunner; readonly generatedFloor: GeneratedFloor; readonly loadAttempt: number;
}): void {
  const { conn, currentWorld, next, generation, runner, generatedFloor } = input;
  if (staleWorldLoad(conn, next, input.loadAttempt)) { runner.dispose(); return; }
  runner.dispose(); conn.worldLoadCancel = null;
  const nextWorld = new World(currentWorld.worldSeed, next, {
    level: currentWorld.level, features: currentWorld.features, generatedFloor, expectedGeneration: generation,
  });
  assertGenerationAgreementWithWorld(generation, nextWorld);
  conn.world = nextWorld; conn.worldReady = true; conn.worldLoading = false; conn.worldLoadError = null;
  conn.pendingFloorTransition = null;
  conn.defeatedMiniBossArenaChunks.clear(); conn.defeatedMiniBossArenaWindowCenter = null;
  conn.miniBossArenaLandmarkRevision++;
  applyPendingWorldSnapshot(conn);
}

function failFloorWorldLoad(input: {
  readonly conn: Connection; readonly next: number; readonly runner: FiniteWorldRunner;
  readonly error: unknown; readonly loadAttempt: number;
}): void {
  if (staleWorldLoad(input.conn, input.next, input.loadAttempt)) return;
  input.runner.dispose(); input.conn.worldLoadCancel = null; input.conn.worldLoading = false;
  input.conn.worldLoadError = input.error instanceof Error ? input.error.message : String(input.error);
  input.conn.onWorldLoadError?.(input.conn.worldLoadError);
  console.error(`[client] finite floor transition failed: ${input.conn.worldLoadError}`);
}

function staleWorldLoad(conn: Connection, floor: number, loadAttempt: number): boolean {
  return conn.status === "closed" || conn.floor !== floor || conn.worldLoadAttempt !== loadAttempt;
}

function applyPendingWorldSnapshot(conn: Connection): void {
  const pending = conn.pendingWorldSnapshot;
  conn.pendingWorldSnapshot = null;
  if (pending) applySnapshot(conn, pending);
}

function assertCurrentGeneration(conn: Connection, snap: ServerSnapshot): void {
  const expected = snap.self.generation;
  const actual = conn.world?.floorIdentity;
  if (!expected || !actual) return;
  if (!sameGenerationIdentity(expected, actual)) {
    throw new Error("Authoritative floor generation identity mismatch");
  }
}

function assertGenerationAgreementWithWorld(
  expected: NonNullable<ServerSnapshot["self"]["generation"]>,
  world: World,
): void {
  if (!sameGenerationIdentity(expected, world.floorIdentity)) {
    throw new Error("Destination floor generation identity mismatch");
  }
}

function sameGenerationIdentity(left: NonNullable<ServerSnapshot["self"]["generation"]>, right: NonNullable<Connection["world"]>["floorIdentity"]): boolean {
  return right !== null && left.seed === right.seed && left.fingerprint === right.fingerprint && left.generatorVersion === right.generatorVersion && left.retryIndex === right.retryIndex && left.configurationFingerprint === right.configurationFingerprint;
}
