import type { GameSim } from "../../sim/core/index.js";
import type { FloorPreparationWorkerClient } from "../floorPreparationWorkerClient.js";
import { prepareUnseenFloor as prepareGeneratedFloor, type FloorPreparationContext, type InstalledFloor } from "../floorRegistryPreparation.js";

export interface FloorRegistryPreparationContext {
  readonly sims: Map<number, GameSim>;
  readonly artifacts: Map<number, string>;
  readonly inFlightPreparations: Map<number, Promise<GameSim>>;
  readonly preparationContext: FloorPreparationContext;
  readonly preparationWorker: FloorPreparationWorkerClient;
}

export function prepareFloor(
  context: FloorRegistryPreparationContext,
  floor: number,
): Promise<GameSim> {
  const existing = context.sims.get(floor);
  if (existing) return Promise.resolve(existing);
  const pending = context.inFlightPreparations.get(floor);
  if (pending) return pending;
  const preparation = prepareGeneratedFloor({
    context: context.preparationContext,
    floor,
    worker: context.preparationWorker,
  }).then((prepared) => installPreparedFloor(context, floor, prepared));
  context.inFlightPreparations.set(floor, preparation);
  void preparation.then(
    () => clearPreparation(context, floor, preparation),
    () => clearPreparation(context, floor, preparation),
  );
  return preparation;
}

export function startPrewarm(
  input: { readonly floor: number; readonly prepare: () => Promise<GameSim> },
): void {
  void input.prepare().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[game-server] floor ${input.floor} prewarm failed: ${message}`);
  });
}

function installPreparedFloor(
  context: FloorRegistryPreparationContext,
  floor: number,
  prepared: InstalledFloor,
): GameSim {
  const existing = context.sims.get(floor);
  if (existing) return existing;
  context.sims.set(floor, prepared.sim);
  context.artifacts.set(floor, prepared.artifact);
  return prepared.sim;
}

function clearPreparation(
  context: FloorRegistryPreparationContext,
  floor: number,
  preparation: Promise<GameSim>,
): void {
  if (context.inFlightPreparations.get(floor) === preparation) {
    context.inFlightPreparations.delete(floor);
  }
}
