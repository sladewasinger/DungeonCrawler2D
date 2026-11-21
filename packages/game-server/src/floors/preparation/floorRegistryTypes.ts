import type {
  ContentRegistry,
  GeneratedFloor,
  ServerSnapshot,
  ServerStateSnapshot,
  WorldFeatures,
} from "@dc2d/engine";
import type { GameSim } from "../../sim/core/index.js";
import type { PreparedSnapshotDelivery } from "../../sim/snapshots/snapshots.js";
import type { PlayerStore } from "../../store.js";

export interface FloorRegistryOptions {
  clusterSpawns?: boolean;
  spawnRadiusTiles?: number | undefined;
  debugCommands?: boolean;
}

export interface FloorRegistryCreation {
  worldSeed: number;
  content: ContentRegistry;
  store: PlayerStore;
  rngSeedBase: number;
  opts: FloorRegistryOptions;
  worldFeatures?: WorldFeatures;
  /** Production starts the next-floor worker while floor 1 is becoming ready. */
  prewarmNextFloor?: boolean;
  /** Test-only immutable floors; production leaves this unset. */
  prebuiltFloors?: ReadonlyMap<number, GeneratedFloor>;
}

export interface TickResult {
  snapshots: Map<string, ServerSnapshot>;
  moved: Array<{ playerId: string; sim: GameSim }>;
}

export interface ReplicationTickResult {
  snapshots: Map<string, ServerStateSnapshot>;
  moved: TickResult["moved"];
}

export interface PreparedReplicationTickResult {
  snapshots: Map<string, PreparedSnapshotDelivery>;
  moved: TickResult["moved"];
}
