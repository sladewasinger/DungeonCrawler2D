/* eslint-disable max-lines -- welcome owns the finite-world handoff lifecycle. */
import {
  LEVEL,
  World,
  createBody,
  type ServerWelcome,
  type SpectatorWelcome,
} from "@dc2d/engine";
import type { Connection } from "./connection.js";
import { createFiniteWorldRunner, type FiniteWorldRunner } from "./finiteWorld/finiteWorldRunner.js";
import type { GeneratedFloor } from "@dc2d/engine";
import { saveResumeToken } from "../auth/identity.js";
import { startCorpNetWatchdog } from "../corpnet/index.js";
import { applySnapshot } from "../sync/apply.js";
import { measureRuntimeWork } from "../../performance/runtimeWorkMetrics.js";

/** Applies the authoritative session identity and fresh world on each welcome. */
export function applyWelcome(conn: Connection, message: ServerWelcome): void {
  applyWorldWelcome(conn, message, true);
}

export function applySpectatorWelcome(
  conn: Connection,
  message: SpectatorWelcome,
): void {
  conn.setName(message.target.name);
  conn.setSkin(message.target.skin);
  conn.spectatorMode = message.mode;
  conn.spectatorTargetId = message.target.playerId;
  applyWorldWelcome(conn, {
    type: "welcome",
    protocol: message.protocol,
    playerId: message.target.playerId,
    resumeToken: "",
    seedInputText: message.seedInputText,
    worldSeed: message.worldSeed,
    floor: message.target.floor,
    level: message.target.level,
    worldFeatures: message.worldFeatures,
    ...(message.generation ? { generation: message.generation } : {}),
    tickRate: message.tickRate,
    spawn: message.spawn,
  }, false);
  conn.spectatorTargetPose = { ...message.spawn };
}

function applyWorldWelcome(
  conn: Connection,
  message: ServerWelcome,
  persistResumeToken: boolean,
): void {
  const notifyConnected = conn.status !== "connected";
  conn.welcome = message;
  conn.status = "connected";
  conn.reconnectAttempts = 0;
  conn.sessionExpired = false;
  conn.sessionEndMessage = null;
  if (persistResumeToken) saveResumeToken(message.resumeToken, message.level);
  prepareWorldLoad(conn, message);
  resetWelcomeState(conn);
  if (message.level !== LEVEL.Dungeon) {
    installWorld({
      conn,
      message,
      world: new World(message.worldSeed, message.floor, {
        level: message.level,
        features: message.worldFeatures,
        ...(message.generation ? { expectedGeneration: message.generation } : {}),
      }),
      notifyConnected,
    });
    return;
  }
  loadFiniteWorld(conn, message, notifyConnected);
}

function prepareWorldLoad(conn: Connection, message: ServerWelcome): void {
  conn.worldLoadAttempt++;
  conn.worldLoadCancel?.();
  conn.worldLoadCancel = null;
  conn.world = null;
  conn.worldReady = false;
  conn.worldLoading = message.level === LEVEL.Dungeon;
  conn.worldLoadError = null; conn.pendingWorldSnapshot = null;
  conn.pendingFloorTransition = null;
  conn.body = createBody(message.spawn.x, message.spawn.y, message.spawn.z);
  if (conn.worldLoading) conn.onWorldLoading?.();
}

function loadFiniteWorld(conn: Connection, message: ServerWelcome, notifyConnected: boolean): void {
  const runner = createFiniteWorldRunner();
  const job = runner.request({
    worldSeed: message.worldSeed,
    floor: message.floor,
    features: message.worldFeatures,
    ...(message.finiteFloorArtifact ? { finiteFloorArtifact: message.finiteFloorArtifact } : {}),
  });
  conn.worldLoadCancel = () => {
    job.cancel();
    runner.dispose();
  };
  void job.promise
    .then((generatedFloor) => completeFiniteWorldLoad({ conn, message, notifyConnected, runner, generatedFloor }))
    .catch((error: unknown) => failFiniteWorldLoad({ conn, message, runner, error }));
}

function completeFiniteWorldLoad(input: {
  readonly conn: Connection; readonly message: ServerWelcome; readonly notifyConnected: boolean;
  readonly runner: FiniteWorldRunner; readonly generatedFloor: GeneratedFloor;
}): void {
  const { conn, message, notifyConnected, runner, generatedFloor } = input;
  if (conn.welcome !== message || conn.status === "closed") { runner.dispose(); return; }
  runner.dispose(); conn.worldLoadCancel = null;
  const world = measureRuntimeWork("world.install", () => new World(message.worldSeed, message.floor, {
    level: message.level, features: message.worldFeatures, generatedFloor,
    ...(message.generation ? { expectedGeneration: message.generation } : {}),
  }));
  installWorld({ conn, message, world, notifyConnected });
}

function failFiniteWorldLoad(input: {
  readonly conn: Connection; readonly message: ServerWelcome; readonly runner: FiniteWorldRunner; readonly error: unknown;
}): void {
  const { conn, message, runner, error } = input;
  if (conn.welcome !== message || conn.status === "closed") return;
  runner.dispose(); conn.worldLoadCancel = null; conn.worldLoading = false;
  conn.worldLoadError = error instanceof Error ? error.message : String(error);
  conn.onWorldLoadError?.(conn.worldLoadError);
  console.error(`[client] finite world loading failed: ${conn.worldLoadError}`);
}

function installWorld(input: {
  readonly conn: Connection;
  readonly message: ServerWelcome;
  readonly world: World;
  readonly notifyConnected: boolean;
}): void {
  const { conn, message, world, notifyConnected } = input;
  conn.world = world;
  conn.worldReady = true;
  conn.worldLoading = false;
  conn.worldLoadError = null;
  conn.corpNet.reset(performance.now());
  startCorpNetWatchdog(conn);
  if (notifyConnected) conn.onConnected?.();
  startPingTimer(conn);
  const pending = conn.pendingWorldSnapshot;
  conn.pendingWorldSnapshot = null;
  if (pending && conn.welcome === message) applySnapshot(conn, pending);
}

function resetWelcomeState(conn: Connection): void {
  conn.prediction.reset(); conn.movementCadence.reset(); conn.predictionCorrection.reset(true);
  conn.serverTimeline.reset(); conn.snapshotRevisions.reset(); conn.entities.clear();
  conn.areaTiles.clear();
  conn.areaTileLayers.clear();
  conn.defeatedMiniBossArenaChunks.clear();
  conn.defeatedMiniBossArenaWindowCenter = null;
  conn.miniBossArenaLandmarkRevision++;
  conn.teleported = true;
}
function startPingTimer(conn: Connection): void {
  if (conn.pingTimer) return;
  conn.pingTimer = setInterval(() => {
    if (conn.ws?.readyState === WebSocket.OPEN) {
      conn.send({ type: "ping", t: performance.now() });
    }
  }, 2_000);
}
