import { DEFAULT_WORLD_FEATURES, LEVEL, World } from "@dc2d/engine";
import { FloorRegistry } from "../../floors/floorRegistry.js";
import { GameSim } from "../../sim/core/index.js";
import type { PlayerStore } from "../../store.js";
import type { ServerOptions } from "../index.js";

export interface ServerSimulations {
  readonly floors: FloorRegistry;
  readonly sandbox: GameSim;
  readonly combatSandbox: GameSim;
}

interface SimulationCreation {
  readonly opts: ServerOptions;
  readonly store: PlayerStore;
  readonly seed: number;
  readonly simOpts: GameSim["state"]["opts"];
}

export function serverSimulationOptions(opts: ServerOptions): GameSim["state"]["opts"] {
  return {
    clusterSpawns: opts.clusterSpawns ?? false,
    spawnRadiusTiles: opts.spawnRadiusTiles,
    debugCommands: opts.debugCommands ?? false,
    freezeEnemies: opts.freezeEnemies ?? false,
  };
}

export function createServerSimulations(input: SimulationCreation): ServerSimulations {
  const { opts, store, seed, simOpts } = input;
  const features = opts.worldFeatures ?? DEFAULT_WORLD_FEATURES;
  const shared = { content: opts.content, store, opts: simOpts };
  return {
    floors: new FloorRegistry({
      worldSeed: opts.worldSeed,
      content: opts.content,
      store,
      rngSeedBase: seed,
      opts: simOpts,
      worldFeatures: features,
      prewarmNextFloor: true,
    }),
    sandbox: new GameSim({
      ...shared,
      world: new World(opts.worldSeed, opts.floor, { level: LEVEL.Sandbox, features }),
      rngSeed: seed + 1000,
    }),
    combatSandbox: new GameSim({
      ...shared,
      world: new World(opts.worldSeed, opts.floor, { level: LEVEL.CombatSandbox, features }),
      rngSeed: seed + 2000,
    }),
  };
}
