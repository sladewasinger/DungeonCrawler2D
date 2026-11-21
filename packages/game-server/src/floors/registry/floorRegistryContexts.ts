import type { GameSim } from "../../sim/core/index.js";
import type { FloorPreparationWorkerClient } from "../floorPreparationWorkerClient.js";
import type { FloorPreparationContext } from "../floorRegistryPreparation.js";
import type { FloorRegistryApplyContext } from "./floorRegistryApply.js";
import type { FloorRegistryPreparationContext } from "./floorRegistryPreparationLifecycle.js";
import type { FloorPreparationQueue } from "../preparation/floorPreparationQueue.js";

export interface FloorRegistryContexts {
  readonly apply: FloorRegistryApplyContext;
  readonly preparation: FloorRegistryPreparationContext;
}

export function createFloorRegistryContexts(input: {
  readonly sims: Map<number, GameSim>;
  readonly artifacts: Map<number, string>;
  readonly transferQueue: FloorPreparationQueue;
  readonly preparationWorker: FloorPreparationWorkerClient;
  readonly preparationContext: FloorPreparationContext;
  readonly inFlightPreparations: Map<number, Promise<GameSim>>;
}): FloorRegistryContexts {
  return {
    apply: input,
    preparation: {
      sims: input.sims,
      artifacts: input.artifacts,
      inFlightPreparations: input.inFlightPreparations,
      preparationContext: input.preparationContext,
      preparationWorker: input.preparationWorker,
    },
  };
}
