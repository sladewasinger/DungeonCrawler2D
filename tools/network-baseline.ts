import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  AOI_RADIUS,
  CHUNK_SIZE,
  LEVEL,
  PLAYER_MAX_STAMINA,
  PROTOCOL_VERSION,
  TICK_RATE,
  World,
  buildContentRegistry,
  createBody,
  decodeClientMessage,
  decodeServerMessage,
  encodeMessage,
  hashString,
  resetEntityIds,
  type BodyState,
  type ClientMessage,
  type MoveInput,
  type PlayerResourceState,
  type ServerMessage,
  type ServerWelcome,
} from "@dc2d/engine";
import { startServer, type RunningServer } from "../packages/game-server/src/server/index.js";
import {
  CORRECTION_HARD_THRESHOLD,
  CORRECTION_SMOOTH_THRESHOLD,
  PredictionCorrection,
} from "../packages/client/src/net/predictionCorrection.js";
import { MovementCadence } from "../packages/client/src/net/movementCadence.js";
import { Prediction } from "../packages/client/src/net/prediction.js";
import { mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { cpus, totalmem, arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { WebSocket } from "ws";

const OUTPUT_FILE = resolve("docs/benchmarks/network-json-baseline.json");
const CORPUS_FILE = resolve("docs/benchmarks/network-packet-corpus.json");
const WORLD_SEED_TEXT = "net-json-baseline-v1";
const RNG_SEED = 424242;
const PLAYER_COUNT = 3;
const PHASE_TICKS = {
  warmup: 10,
  idle: 20,
  movement: 20,
  gameplay: 20,
  aoiChunkCrossing: 20,
  lossRecovery: 12,
  reconnect: 20,
} as const;

type Phase = keyof typeof PHASE_TICKS | "handshake" | "complete";
type Direction = "clientToServer" | "serverToClient";

interface PacketRecord {
  index: number;
  client: string;
  phase: Phase;
  direction: Direction;
  type: string;
  bytes: number;
  payload: string;
}

interface TimedSample {
  client: string;
  phase: Phase;
  milliseconds: number;
}

interface AckSample extends TimedSample {
  seq: number;
  projectedServerTick: number;
  acknowledgedProjectedServerTick: number;
}

interface PendingAck {
  sentAt: number;
  phase: Phase;
  projectedServerTick: number;
}

interface CorrectionSample extends TimedSample {
  error: number;
  kind: "none" | "smooth" | "hard";
}

const packetRecords: PacketRecord[] = [];
const encodeSamples: TimedSample[] = [];
const decodeSamples: TimedSample[] = [];
const ackSamples: AckSample[] = [];
const correctionSamples: CorrectionSample[] = [];
const queueByteSamples: number[] = [];
const stepPhaseSamples: TimedSample[] = [];
let currentPhase: Phase = "handshake";

function byteLength(payload: string): number {
  return Buffer.byteLength(payload, "utf8");
}

function packetType(payload: string): string {
  try {
    const value = JSON.parse(payload) as { type?: unknown };
    return typeof value.type === "string" ? value.type : "invalid";
  } catch {
    return "invalid";
  }
}

function recordPacket(
  client: string,
  direction: Direction,
  payload: string,
): void {
  packetRecords.push({
    index: packetRecords.length,
    client,
    phase: currentPhase,
    direction,
    type: packetType(payload),
    bytes: byteLength(payload),
    payload,
  });
}

class ScriptedClient {
  private socket: WebSocket | null = null;
  private readonly pendingAcks = new Map<number, PendingAck>();
  private welcomeResolver: ((welcome: ServerWelcome) => void) | null = null;
  private welcomeRejecter: ((error: Error) => void) | null = null;
  private closedResolver: (() => void) | null = null;
  private readonly prediction = new Prediction();
  private readonly cadence = new MovementCadence();
  private readonly correction = new PredictionCorrection();
  private world: World | null = null;
  private body: BodyState | null = null;
  private resources: PlayerResourceState = {
    stamina: PLAYER_MAX_STAMINA,
    maxStamina: PLAYER_MAX_STAMINA,
    blocking: false,
  };
  private weapon: string | null = null;
  readonly schemaDecodeFailures: string[] = [];
  latestServerTick = 0;
  welcome: ServerWelcome | null = null;
  baselineCount = 0;
  recoveryBaselineCount = 0;
  ignoredDeltaCount = 0;
  ignoreNextIncrementalDelta = false;

  constructor(
    readonly label: string,
    private readonly url: string,
    private readonly clientId: string,
  ) {}

  connect(resumeToken?: string): Promise<ServerWelcome> {
    this.socket = new WebSocket(this.url);
    const promise = new Promise<ServerWelcome>((resolve, reject) => {
      this.welcomeResolver = resolve;
      this.welcomeRejecter = reject;
    });
    this.socket.once("error", (error) => {
      this.welcomeRejecter?.(error);
      this.welcomeRejecter = null;
    });
    this.socket.on("message", (raw) => this.receive(raw.toString()));
    this.socket.once("close", () => {
      this.closedResolver?.();
      this.closedResolver = null;
    });
    this.socket.once("open", () => {
      this.send({
        type: "hello",
        protocol: PROTOCOL_VERSION,
        name: this.label,
        clientId: this.clientId,
        level: LEVEL.Sandbox,
        snapshotMode: "delta-v1",
        ...(resumeToken ? { resumeToken } : {}),
      }, false);
    });
    return promise;
  }

  send(message: ClientMessage, trackAck = true): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error(`${this.label} socket is not open`);
    }
    const startedAt = performance.now();
    const payload = encodeMessage(message);
    if (!decodeClientMessage(payload)) {
      throw new Error(`${this.label} encoded an invalid ${message.type} packet`);
    }
    const encodedAt = performance.now();
    encodeSamples.push({
      client: this.label,
      phase: currentPhase,
      milliseconds: encodedAt - startedAt,
    });
    recordPacket(this.label, "clientToServer", payload);
    this.socket.send(payload);
    queueByteSamples.push(this.socket.bufferedAmount);
    if (trackAck && message.type === "input") {
      this.pendingAcks.set(message.seq, {
        sentAt: encodedAt,
        phase: currentPhase,
        projectedServerTick: message.projectedServerTick,
      });
    }
  }

  sampleInput(input: MoveInput): void {
    if (!this.world || !this.body || this.latestServerTick === 0) return;
    const projectedServerTick = this.prediction.predict(
      this.world,
      this.body,
      input,
      this.resources,
      this.weapon !== null,
    );
    if (!this.cadence.shouldSend(input)) return;
    const identity = this.prediction.nextInputIdentity(projectedServerTick);
    this.send({
      type: "input",
      seq: identity.seq,
      projectedServerTick: identity.projectedServerTick,
      moveX: input.moveX,
      moveY: input.moveY,
      ...(input.faceX !== undefined ? { faceX: input.faceX } : {}),
      ...(input.faceY !== undefined ? { faceY: input.faceY } : {}),
      jump: input.jump,
      run: input.run ?? false,
      block: input.block ?? false,
    });
  }

  close(): Promise<void> {
    if (!this.socket || this.socket.readyState >= WebSocket.CLOSING) {
      return Promise.resolve();
    }
    const promise = new Promise<void>((resolve) => {
      this.closedResolver = resolve;
    });
    this.socket.close(1000, "benchmark reconnect");
    return promise;
  }

  queueBytes(): number {
    return this.socket?.bufferedAmount ?? 0;
  }

  private receive(payload: string): void {
    recordPacket(this.label, "serverToClient", payload);
    const startedAt = performance.now();
    const message = decodeServerMessage(payload);
    const decodedAt = performance.now();
    decodeSamples.push({
      client: this.label,
      phase: currentPhase,
      milliseconds: decodedAt - startedAt,
    });
    if (!message) {
      this.schemaDecodeFailures.push(
        `${currentPhase}:${packetType(payload)}:${payload.slice(0, 160)}`,
      );
      return;
    }
    if (message.type === "welcome") {
      this.welcome = message;
      this.world = new World(message.worldSeed, message.floor, message.level);
      this.body = createBody(message.spawn.x, message.spawn.y, message.spawn.z);
      this.prediction.reset();
      this.cadence.reset();
      this.correction.reset(true);
      this.welcomeResolver?.(message);
      this.welcomeResolver = null;
      this.welcomeRejecter = null;
      return;
    }
    if (message.type === "snapshot" || message.type === "snapshotDelta") {
      this.receiveSnapshot(message, decodedAt);
    }
  }

  private receiveSnapshot(
    message: Extract<ServerMessage, { type: "snapshot" | "snapshotDelta" }>,
    decodedAt: number,
  ): void {
    if (!this.world) return;
    if (message.events.some((event) => event.t === "teleported")) {
      this.prediction.reset();
      this.correction.reset(true);
    }
    const predictedBefore = this.body ? { ...this.body } : null;
    this.resources.stamina = message.self.stamina ?? this.resources.stamina;
    this.resources.maxStamina = message.self.maxStamina ?? this.resources.maxStamina;
    this.resources.blocking = message.self.blocking ?? false;
    this.weapon = message.weapon;
    this.body = {
      x: message.self.x,
      y: message.self.y,
      z: message.self.z,
      zVel: message.self.zVel,
      grounded: message.self.grounded,
      coyoteTime: message.self.coyoteTime,
      jumpBuffer: message.self.jumpBuffer,
      jumpHeld: message.self.jumpHeld,
      fallStart: message.self.z,
      kx: message.self.kx,
      ky: message.self.ky,
    };
    const acknowledgedTick = message.lastProjectedServerTick >= 0
      ? message.lastProjectedServerTick
      : message.tick;
    this.prediction.reconcile(
      this.world,
      this.body,
      acknowledgedTick,
      this.resources,
      message.weapon !== null,
    );
    if (predictedBefore) {
      this.correction.record(predictedBefore, this.body);
      const error = this.correction.lastError;
      correctionSamples.push({
        client: this.label,
        phase: currentPhase,
        milliseconds: decodedAt,
        error,
        kind: error >= CORRECTION_HARD_THRESHOLD
          ? "hard"
          : error >= CORRECTION_SMOOTH_THRESHOLD
            ? "smooth"
            : "none",
      });
      this.correction.consumeHardSnap();
    }
    this.latestServerTick = message.tick;
    if (message.type === "snapshotDelta" && message.baseline) {
      this.baselineCount++;
      if (currentPhase === "lossRecovery" || currentPhase === "reconnect") {
        this.recoveryBaselineCount++;
      }
    }
    if (
      message.type === "snapshotDelta" &&
      !message.baseline &&
      this.ignoreNextIncrementalDelta
    ) {
      this.ignoreNextIncrementalDelta = false;
      this.ignoredDeltaCount++;
      this.send({ type: "snapshotResync" }, false);
    }
    for (const [seq, pending] of this.pendingAcks) {
      if (seq > message.lastSeq) continue;
      ackSamples.push({
        client: this.label,
        phase: pending.phase,
        seq,
        projectedServerTick: pending.projectedServerTick,
        acknowledgedProjectedServerTick: message.lastProjectedServerTick,
        milliseconds: decodedAt - pending.sentAt,
      });
      this.pendingAcks.delete(seq);
    }
  }
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function distribution(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    mean: values.length > 0 ? total / values.length : 0,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

function summarizePackets(records: PacketRecord[], durationSeconds: number) {
  const bytes = records.reduce((sum, packet) => sum + packet.bytes, 0);
  return {
    packets: records.length,
    bytes,
    messagesPerSecond: records.length / durationSeconds,
    bytesPerSecond: bytes / durationSeconds,
    packetBytes: distribution(records.map((packet) => packet.bytes)),
  };
}

function summarizeCorrections(
  samples: CorrectionSample[],
  durationSeconds: number,
) {
  const visible = samples.filter((sample) => sample.kind !== "none");
  return {
    samples: samples.length,
    visibleCorrectionCount: visible.length,
    visibleCorrectionsPerSecond: visible.length / durationSeconds,
    correctedSnapshotFraction: samples.length > 0 ? visible.length / samples.length : 0,
    smoothCount: visible.filter((sample) => sample.kind === "smooth").length,
    hardCount: visible.filter((sample) => sample.kind === "hard").length,
    error: distribution(samples.map((sample) => sample.error)),
    visibleError: distribution(visible.map((sample) => sample.error)),
  };
}

function groupBy<T>(
  values: T[],
  key: (value: T) => string,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const value of values) (groups[key(value)] ??= []).push(value);
  return groups;
}

function mapGroups<T, R>(
  groups: Record<string, T[]>,
  summarize: (values: T[]) => R,
): Record<string, R> {
  return Object.fromEntries(
    Object.entries(groups).map(([key, values]) => [key, summarize(values)]),
  );
}

async function waitForListening(server: RunningServer): Promise<number> {
  if (server.wss.address()) return (server.wss.address() as AddressInfo).port;
  await new Promise<void>((resolvePromise, reject) => {
    server.wss.once("listening", resolvePromise);
    server.wss.once("error", reject);
  });
  return (server.wss.address() as AddressInfo).port;
}

async function waitForTick(server: RunningServer, targetTick: number): Promise<void> {
  while (server.sims.sandbox.tick < targetTick) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  }
}

const IDLE_INPUT: MoveInput = {
  moveX: 0,
  moveY: 0,
  jump: false,
  run: false,
  block: false,
};

async function sampleClientsUntil(
  server: RunningServer,
  clients: ScriptedClient[],
  targetTick: number,
  inputFor: (client: ScriptedClient) => MoveInput = () => IDLE_INPUT,
): Promise<void> {
  while (server.sims.sandbox.tick < targetTick) {
    for (const client of clients) client.sampleInput(inputFor(client));
    await waitForTick(server, server.sims.sandbox.tick + 1);
  }
}

async function phase(
  server: RunningServer,
  name: keyof typeof PHASE_TICKS,
  work?: (startTick: number) => Promise<void>,
): Promise<void> {
  currentPhase = name;
  const startTick = server.sims.sandbox.tick;
  await work?.(startTick);
  await waitForTick(server, startTick + PHASE_TICKS[name]);
}

function instrumentServerSteps(server: RunningServer): {
  floor: number[];
  sandbox: number[];
  combined: number[];
} {
  const samples = { floor: [] as number[], sandbox: [] as number[], combined: [] as number[] };
  let floorMilliseconds = 0;
  const floors = server.floors as unknown as {
    stepAllPreparedReplicated: () => unknown;
  };
  const originalFloors = floors.stepAllPreparedReplicated.bind(floors);
  floors.stepAllPreparedReplicated = () => {
    const startedAt = performance.now();
    const result = originalFloors();
    floorMilliseconds = performance.now() - startedAt;
    samples.floor.push(floorMilliseconds);
    return result;
  };
  const sandbox = server.sims.sandbox as unknown as {
    stepPreparedReplicated: () => unknown;
  };
  const originalSandbox = sandbox.stepPreparedReplicated.bind(sandbox);
  sandbox.stepPreparedReplicated = () => {
    const startedAt = performance.now();
    const result = originalSandbox();
    const sandboxMilliseconds = performance.now() - startedAt;
    samples.sandbox.push(sandboxMilliseconds);
    samples.combined.push(floorMilliseconds + sandboxMilliseconds);
    stepPhaseSamples.push({
      client: "server",
      phase: currentPhase,
      milliseconds: floorMilliseconds + sandboxMilliseconds,
    });
    return result;
  };
  return samples;
}

async function run(): Promise<void> {
  resetEntityIds();
  const content = buildContentRegistry({
    statuses: [...statusesData],
    rules: [...rulesData],
    areas: [...areasData],
    items: [...itemsData],
    enemies: [...enemiesData],
    recipes: [...recipesData],
  });
  const server = startServer({
    port: 0,
    worldSeed: hashString(WORLD_SEED_TEXT),
    floor: 1,
    content,
    storeFile: null,
    rngSeed: RNG_SEED,
    clusterSpawns: true,
    debugCommands: true,
    freezeEnemies: true,
    testFixtures: true,
  });
  instrumentServerSteps(server);
  const port = await waitForListening(server);
  const url = `ws://127.0.0.1:${port}`;
  const clients = Array.from(
    { length: PLAYER_COUNT },
    (_, index) => new ScriptedClient(
      `bench-${String.fromCharCode(97 + index)}`,
      url,
      `network-baseline-client-${index + 1}`,
    ),
  );
  try {
    const welcomes = await Promise.all(clients.map((client) => client.connect()));
    await phase(server, "warmup");
    const measuredStartTick = server.sims.sandbox.tick;

    await phase(server, "idle", async (startTick) => {
      await sampleClientsUntil(server, clients, startTick + PHASE_TICKS.idle);
    });

    await phase(server, "movement", async (startTick) => {
      const primary = clients[0];
      if (!primary) throw new Error("missing movement client");
      await sampleClientsUntil(server, clients, startTick + 5, (client) =>
        client === primary
          ? { moveX: 1, moveY: 0, jump: false, run: true, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(server, clients, startTick + 10, (client) =>
        client === primary
          ? { moveX: 0, moveY: 1, jump: false, run: false, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(server, clients, startTick + 11, (client) =>
        client === primary
          ? { moveX: -1, moveY: 0, jump: true, run: false, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(server, clients, startTick + 15, (client) =>
        client === primary
          ? { moveX: -1, moveY: 0, jump: false, run: false, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(server, clients, startTick + PHASE_TICKS.movement);
    });

    await phase(server, "gameplay", async (startTick) => {
      const first = clients[0];
      const second = clients[1];
      const firstSpawn = welcomes[0]?.spawn;
      if (!first || !second || !firstSpawn) throw new Error("missing scripted client");
      first.send({ type: "chat", channel: "global", text: "deterministic baseline" }, false);
      first.send({ type: "equip", item: "sword" }, false);
      first.send({ type: "assign", slot: 2, item: "torch" }, false);
      second.send({
        type: "debug",
        op: "teleport",
        x: firstSpawn.x + 1,
        y: firstSpawn.y,
      }, false);
      await sampleClientsUntil(server, clients, startTick + 3);
      first.send({ type: "attack", dirX: 1, dirY: 0 }, false);
      second.send({ type: "throwTorch", dirX: 0, dirY: 1 }, false);
      await sampleClientsUntil(server, clients, startTick + 10);
      first.send({ type: "pickup" }, false);
      first.send({ type: "drop", item: "torch" }, false);
      await sampleClientsUntil(server, clients, startTick + PHASE_TICKS.gameplay);
    });

    await phase(server, "aoiChunkCrossing", async (startTick) => {
      const third = clients[2];
      const spawn = welcomes[2]?.spawn;
      if (!third || !spawn) throw new Error("missing AOI client");
      third.send({
        type: "debug",
        op: "teleport",
        x: spawn.x + AOI_RADIUS * 3,
        y: spawn.y,
      }, false);
      await sampleClientsUntil(server, clients, startTick + 6);
      third.send({
        type: "debug",
        op: "teleport",
        x: spawn.x + CHUNK_SIZE + 1,
        y: spawn.y + CHUNK_SIZE + 1,
      }, false);
      await sampleClientsUntil(server, clients, startTick + 12);
      third.send({ type: "debug", op: "teleport", x: spawn.x, y: spawn.y }, false);
      await sampleClientsUntil(
        server,
        clients,
        startTick + PHASE_TICKS.aoiChunkCrossing,
      );
    });

    await phase(server, "lossRecovery", async (startTick) => {
      const first = clients[0];
      if (!first) throw new Error("missing recovery client");
      first.ignoreNextIncrementalDelta = true;
      await sampleClientsUntil(server, clients, startTick + 5, (client) =>
        client === first
          ? { moveX: 1, moveY: 0, jump: false, run: false, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(
        server,
        clients,
        startTick + PHASE_TICKS.lossRecovery,
      );
    });

    await phase(server, "reconnect", async (startTick) => {
      const second = clients[1];
      const welcome = second?.welcome;
      if (!second || !welcome) throw new Error("missing reconnect client");
      await second.close();
      await sampleClientsUntil(
        server,
        clients.filter((client) => client !== second),
        startTick + 4,
      );
      const replacement = new ScriptedClient(
        second.label,
        url,
        "network-baseline-client-2",
      );
      clients[1] = replacement;
      await replacement.connect(welcome.resumeToken);
      while (replacement.latestServerTick === 0) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
      }
      await sampleClientsUntil(server, clients, startTick + 10, (client) =>
        client === replacement
          ? { moveX: 0, moveY: -1, jump: false, run: false, block: false }
          : IDLE_INPUT);
      await sampleClientsUntil(
        server,
        clients,
        startTick + PHASE_TICKS.reconnect,
      );
    });

    const measuredEndTick = server.sims.sandbox.tick;
    currentPhase = "complete";
    await waitForTick(server, measuredEndTick + 2);
    const durationSeconds = (measuredEndTick - measuredStartTick) / TICK_RATE;
    const warmPackets = packetRecords.filter(
      (packet) =>
        packet.phase !== "handshake" &&
        packet.phase !== "warmup" &&
        packet.phase !== "complete",
    );
    const warmEncode = encodeSamples.filter(
      (sample) => sample.phase !== "handshake" && sample.phase !== "warmup",
    );
    const warmDecode = decodeSamples.filter(
      (sample) => sample.phase !== "handshake" && sample.phase !== "warmup",
    );
    const warmSteps = stepPhaseSamples
      .filter((sample) =>
        sample.phase !== "handshake" &&
        sample.phase !== "warmup" &&
        sample.phase !== "complete")
      .map((sample) => sample.milliseconds);
    const warmCorrections = correctionSamples.filter(
      (sample) =>
        sample.phase !== "handshake" &&
        sample.phase !== "warmup" &&
        sample.phase !== "complete",
    );
    const ordinaryCorrections = warmCorrections.filter(
      (sample) =>
        sample.phase === "idle" ||
        sample.phase === "movement" ||
        sample.phase === "lossRecovery",
    );
    const schemaDecodeFailures = clients.flatMap((client) =>
      client.schemaDecodeFailures.map((failure) => `${client.label}:${failure}`));
    if (schemaDecodeFailures.length > 0) {
      throw new Error(
        `protocol schema rejected ${schemaDecodeFailures.length} server packets:\n` +
        schemaDecodeFailures.slice(0, 5).join("\n"),
      );
    }
    const diagnostics = server.networkMetrics.snapshot(performance.now());
    const baseline = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      command: "npm run benchmark:network",
      codec: "json",
      deterministicInputs: {
        worldSeedText: WORLD_SEED_TEXT,
        worldSeed: hashString(WORLD_SEED_TEXT),
        rngSeed: RNG_SEED,
        tickRate: TICK_RATE,
        playerCount: PLAYER_COUNT,
        phaseTicks: PHASE_TICKS,
        measuredTicks: measuredEndTick - measuredStartTick,
        measuredDurationSeconds: durationSeconds,
      },
      runtime: {
        node: process.version,
        v8: process.versions.v8,
        platform: platform(),
        release: release(),
        arch: arch(),
        cpu: cpus()[0]?.model ?? "unknown",
        logicalCpuCount: cpus().length,
        totalMemoryBytes: totalmem(),
      },
      warm: {
        aggregate: summarizePackets(warmPackets, durationSeconds),
        directions: mapGroups(
          groupBy(warmPackets, (packet) => packet.direction),
          (records) => summarizePackets(records, durationSeconds),
        ),
        clients: mapGroups(
          groupBy(warmPackets, (packet) => packet.client),
          (records) => summarizePackets(records, durationSeconds),
        ),
        phases: mapGroups(
          groupBy(warmPackets, (packet) => packet.phase),
          (records) => summarizePackets(
            records,
            PHASE_TICKS[records[0]?.phase as keyof typeof PHASE_TICKS] / TICK_RATE,
          ),
        ),
        packetTypes: mapGroups(
          groupBy(warmPackets, (packet) =>
            `${packet.direction}:${packet.type}`),
          (records) => summarizePackets(records, durationSeconds),
        ),
        clientEncodeMilliseconds: distribution(
          warmEncode.map((sample) => sample.milliseconds),
        ),
        clientDecodeMilliseconds: distribution(
          warmDecode.map((sample) => sample.milliseconds),
        ),
        serverStepMilliseconds: distribution(warmSteps),
        inputToAckMilliseconds: distribution(
          ackSamples.map((sample) => sample.milliseconds),
        ),
        reconciliation: {
          ...summarizeCorrections(warmCorrections, durationSeconds),
          ordinaryMovementAndLoss: summarizeCorrections(
            ordinaryCorrections,
            (
              PHASE_TICKS.idle +
              PHASE_TICKS.movement +
              PHASE_TICKS.lossRecovery
            ) / TICK_RATE,
          ),
          phases: mapGroups(
            groupBy(warmCorrections, (sample) => sample.phase),
            (samples) => summarizeCorrections(
              samples,
              PHASE_TICKS[samples[0]?.phase as keyof typeof PHASE_TICKS] / TICK_RATE,
            ),
          ),
        },
        clientQueueBytes: distribution(queueByteSamples),
        maximumClientQueueBytes: Math.max(
          ...queueByteSamples,
          ...clients.map((client) => client.queueBytes()),
        ),
      },
      acknowledgements: ackSamples,
      recovery: Object.fromEntries(clients.map((client) => [client.label, {
        baselines: client.baselineCount,
        recoveryBaselines: client.recoveryBaselineCount,
        intentionallyIgnoredDeltas: client.ignoredDeltaCount,
      }])),
      serverDiagnostics: {
        aggregate: diagnostics.server,
        clients: Object.fromEntries(diagnostics.clients),
      },
      schemaValidation: {
        decoder: "decodeServerMessage",
        rejectedPackets: schemaDecodeFailures.length,
      },
      corpusFile: "network-packet-corpus.json",
      limitations: [
        "Loopback WebSockets do not create representative WAN latency or sustained socket backpressure.",
        "The loss phase intentionally ignores one delivered delta; WebSocket/TCP itself remains reliable and ordered.",
        "Headless clients execute production Prediction, MovementCadence, and PredictionCorrection, but do not include renderer frame stalls.",
        "Server-step timing is benchmark-local wrapping of the real floor and sandbox step calls.",
      ],
    };
    const corpus = {
      schemaVersion: 1,
      codec: "json",
      worldSeedText: WORLD_SEED_TEXT,
      rngSeed: RNG_SEED,
      records: packetRecords,
    };
    await mkdir(dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(OUTPUT_FILE, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    await writeFile(CORPUS_FILE, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      output: OUTPUT_FILE,
      corpus: CORPUS_FILE,
      packets: baseline.warm.aggregate.packets,
      bytesPerSecond: baseline.warm.aggregate.bytesPerSecond,
      packetBytesP95: baseline.warm.aggregate.packetBytes.p95,
      serverStepP95Ms: baseline.warm.serverStepMilliseconds.p95,
      inputToAckP95Ms: baseline.warm.inputToAckMilliseconds.p95,
      visibleCorrections: baseline.warm.reconciliation.visibleCorrectionCount,
      correctionErrorP95: baseline.warm.reconciliation.error.p95,
      schemaRejectedPackets: baseline.schemaValidation.rejectedPackets,
    }, null, 2));
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    server.stop();
  }
}

await run();
