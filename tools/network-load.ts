import { buildContentRegistry, hashString, resetEntityIds } from "@dc2d/engine";
import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import { mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  startServer,
  type RunningServer,
} from "../packages/game-server/src/server/index.js";
import {
  NetworkLoadClient,
  type LoadClientMetrics,
} from "./network-load-client.js";
import {
  LOAD_CLIENT_COUNT,
  LOAD_MEASURED_TICKS,
  buildNetworkLoadResult,
  type NetworkLoadResult,
} from "./network-load-report.js";

const WARMUP_TICKS = 10;
const OUTPUT_FILE = resolve("docs/benchmarks/network-load-20.json");

const waitForTick = async (
  server: RunningServer,
  target: number,
): Promise<void> => {
  while (server.sims.sandbox.tick < target) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2));
  }
};

const listenPort = async (server: RunningServer): Promise<number> => {
  if (!server.wss.address()) {
    await new Promise<void>((resolvePromise, reject) => {
      server.wss.once("listening", resolvePromise);
      server.wss.once("error", reject);
    });
  }
  return (server.wss.address() as AddressInfo).port;
};

const instrumentSteps = (server: RunningServer): number[] => {
  const samples: number[] = [];
  const sandbox = server.sims.sandbox as unknown as {
    stepPreparedReplicated: () => unknown;
  };
  const original = sandbox.stepPreparedReplicated.bind(sandbox);
  sandbox.stepPreparedReplicated = () => {
    const startedAt = performance.now();
    const result = original();
    samples.push(performance.now() - startedAt);
    return result;
  };
  return samples;
};

const aggregateMetrics = (
  clients: NetworkLoadClient[],
): LoadClientMetrics => clients.reduce<LoadClientMetrics>(
  (total, client) => ({
    sentBytes: total.sentBytes + client.metrics.sentBytes,
    receivedBytes: total.receivedBytes + client.metrics.receivedBytes,
    maximumQueueBytes: Math.max(
      total.maximumQueueBytes,
      client.metrics.maximumQueueBytes,
    ),
    decodeFailures: total.decodeFailures + client.metrics.decodeFailures,
  }),
  {
    sentBytes: 0,
    receivedBytes: 0,
    maximumQueueBytes: 0,
    decodeFailures: 0,
  },
);

const buildContent = () => buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

const createServer = (): RunningServer => startServer({
  port: 0,
  worldSeed: hashString("network-load-20-v1"),
  floor: 1,
  content: buildContent(),
  storeFile: null,
  rngSeed: 20260725,
  clusterSpawns: true,
  freezeEnemies: true,
  testFixtures: true,
});

const connectClients = async (
  server: RunningServer,
): Promise<NetworkLoadClient[]> => {
  const port = await listenPort(server);
  const clients = Array.from(
    { length: LOAD_CLIENT_COUNT },
    (_, index) =>
      new NetworkLoadClient(`ws://127.0.0.1:${port}`, index),
  );
  await Promise.all(clients.map((client) => client.connected()));
  return clients;
};

async function exercise(
  server: RunningServer,
  clients: NetworkLoadClient[],
): Promise<{ heapStart: number; heapEnd: number }> {
  await waitForTick(server, server.sims.sandbox.tick + WARMUP_TICKS);
  const heapStart = process.memoryUsage().heapUsed;
  const startTick = server.sims.sandbox.tick;
  while (server.sims.sandbox.tick < startTick + LOAD_MEASURED_TICKS) {
    const relativeTick = server.sims.sandbox.tick - startTick;
    clients.forEach((client, index) => client.sample(relativeTick, index));
    await waitForTick(server, server.sims.sandbox.tick + 1);
  }
  return { heapStart, heapEnd: process.memoryUsage().heapUsed };
}

async function publish(result: NetworkLoadResult): Promise<void> {
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

async function run(): Promise<void> {
  resetEntityIds();
  const server = createServer();
  const stepSamples = instrumentSteps(server);
  let clients: NetworkLoadClient[] = [];
  try {
    clients = await connectClients(server);
    const beforeMeasure = stepSamples.length;
    const memory = await exercise(server, clients);
    const measuredSteps = stepSamples.slice(beforeMeasure + WARMUP_TICKS);
    await publish(buildNetworkLoadResult(measuredSteps, aggregateMetrics(clients), memory));
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    server.stop();
  }
}

await run();
