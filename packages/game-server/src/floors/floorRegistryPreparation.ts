import {
  LEVEL,
  World,
  type GeneratedFloor,
  type FloorGenerationConfig,
  type FloorGenerationIdentity,
  type WorldFeatures,
  type ContentRegistry,
} from "@dc2d/engine";
import { GameSim } from "../sim/core/index.js";
import { PlayerStore } from "../store.js";
import { encodeFiniteFloorArtifact } from "./finiteFloorArtifact.js";
import type { FloorPreparationWorkerClient, PreparedFloor } from "./floorPreparationWorkerClient.js";
import type { FloorRegistryOptions } from "./preparation/floorRegistryTypes.js";
import { measureServerAsyncWork, measureServerWork } from "../server/runtime/runtimeWork.js";
import { FLOOR_CAP } from "../sim/floors/constants.js";

export interface FloorPreparationContext {
  readonly worldSeed: number;
  readonly content: ContentRegistry;
  readonly store: PlayerStore;
  readonly rngSeedBase: number;
  readonly opts: FloorRegistryOptions;
  readonly worldFeatures: WorldFeatures;
}

export interface InstalledFloor {
  readonly sim: GameSim;
  readonly artifact: string;
}

export interface PreparedFloorRequest {
  readonly floor: number;
  readonly config?: FloorGenerationConfig;
  readonly expectedGeneration?: FloorGenerationIdentity;
}

export function clampFloor(floor: number): number {
  return Math.min(Math.max(Math.floor(floor), 1), FLOOR_CAP);
}

export function createInitialFloor(
  context: FloorPreparationContext,
  floor: number,
  generatedFloor?: GeneratedFloor,
): InstalledFloor {
  const sim = createFloorSim(context, floor, generatedFloor);
  const canonicalFloor = sim.world.generatedFloor;
  if (!canonicalFloor || !sim.world.floorIdentity) {
    throw new Error(`Floor ${floor} did not produce a canonical finite floor`);
  }
  return installFloor(sim, canonicalFloor);
}

export interface PrepareUnseenFloorRequest {
  readonly context: FloorPreparationContext;
  readonly floor: number;
  readonly worker: FloorPreparationWorkerClient;
  readonly config?: FloorGenerationConfig;
}

export async function prepareUnseenFloor(
  input: PrepareUnseenFloorRequest,
): Promise<InstalledFloor> {
  const prepared = await measureServerAsyncWork(
    "server.floorPreparation.worker",
    () => input.worker.prepare({
      worldSeed: input.context.worldSeed,
      floor: input.floor,
      voidTerrain: input.context.worldFeatures.voidTerrain,
      ...(input.config ? { config: input.config } : {}),
    }),
  );
  return measureServerWork(
    "server.floorPreparation.install",
    () => installPreparedFloor(input.context, input.floor, prepared),
  );
}

function installPreparedFloor(
  context: FloorPreparationContext,
  floor: number,
  prepared: PreparedFloor,
): InstalledFloor {
  const sim = createFloorSim(context, floor, prepared.floor);
  sim.setFiniteFloorArtifact(prepared.artifact);
  return { sim, artifact: prepared.artifact };
}

function createFloorSim(
  context: FloorPreparationContext,
  floor: number,
  generatedFloor?: GeneratedFloor,
): GameSim {
  return new GameSim({
    world: new World(context.worldSeed, floor, {
      level: LEVEL.Dungeon,
      features: context.worldFeatures,
      ...(generatedFloor ? { generatedFloor } : {}),
    }),
    content: context.content,
    store: context.store,
    rngSeed: context.rngSeedBase + floor,
    opts: context.opts,
  });
}

function installFloor(sim: GameSim, generatedFloor: GeneratedFloor): InstalledFloor {
  const artifact = encodeFiniteFloorArtifact(generatedFloor);
  sim.setFiniteFloorArtifact(artifact);
  return { sim, artifact };
}
