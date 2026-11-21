import {
  type FloorGenerationConfig,
  type FloorGenerationIdentity,
  isTerritoryId,
} from "@dc2d/engine";
import type { GameSim } from "../../sim/core/index.js";
import type { FloorPreparationWorkerClient } from "../floorPreparationWorkerClient.js";
import type { FloorPreparationContext, InstalledFloor, PreparedFloorRequest } from "../floorRegistryPreparation.js";
import type { FloorPreparationQueue } from "../preparation/floorPreparationQueue.js";
import { prepareUnseenFloor as prepareGeneratedFloor } from "../floorRegistryPreparation.js";
import { FLOOR_CAP } from "../../sim/floors/constants.js";

export interface FloorRegistryApplyContext {
  readonly sims: Map<number, GameSim>;
  readonly artifacts: Map<number, string>;
  readonly transferQueue: FloorPreparationQueue;
  readonly preparationWorker: FloorPreparationWorkerClient;
  readonly preparationContext: FloorPreparationContext;
  readonly inFlightPreparations: Map<number, Promise<GameSim>>;
}

export type ApplyGeneratedFloorResult =
  | { readonly ok: true; readonly floor: number; readonly generation: FloorGenerationIdentity }
  | { readonly ok: false; readonly code: "confirmation_required" | "invalid_floor" | "invalid_configuration" | "floor_in_use" | "floor_busy" | "floor_changed" | "generation_mismatch" };

export async function applyGeneratedFloor(
  context: FloorRegistryApplyContext,
  request: PreparedFloorRequest & { readonly confirm: boolean },
): Promise<ApplyGeneratedFloorResult> {
  const validation = validateRequest(context, request);
  if (validation) return validation;
  const existing = context.sims.get(request.floor);
  const prepared = await prepareGeneratedFloor({
    context: context.preparationContext,
    floor: request.floor,
    worker: context.preparationWorker,
    ...(request.config ? { config: request.config } : {}),
  });
  return installReplacement({ context, request, existing, prepared });
}

function validateRequest(
  context: FloorRegistryApplyContext,
  request: PreparedFloorRequest & { readonly confirm: boolean },
): ApplyGeneratedFloorResult | null {
  if (!request.confirm) return { ok: false, code: "confirmation_required" };
  if (invalidFloor(request.floor)) {
    return { ok: false, code: "invalid_floor" };
  }
  if (!validTerritoryRoster(request.config)) return { ok: false, code: "invalid_configuration" };
  const existing = context.sims.get(request.floor);
  if (hasLivePlayers(existing)) return { ok: false, code: "floor_in_use" };
  if (floorIsBusy(context, request.floor)) return { ok: false, code: "floor_busy" };
  return null;
}

interface ReplacementInput {
  readonly context: FloorRegistryApplyContext;
  readonly request: PreparedFloorRequest & { readonly confirm: boolean };
  readonly existing: GameSim | undefined;
  readonly prepared: InstalledFloor;
}

function installReplacement(input: ReplacementInput): ApplyGeneratedFloorResult {
  const { context, request, existing, prepared } = input;
  const current = context.sims.get(request.floor);
  if (current !== existing) return { ok: false, code: "floor_changed" };
  if (hasLivePlayers(current)) return { ok: false, code: "floor_in_use" };
  const generation = currentGeneration(prepared.sim);
  if (request.expectedGeneration && !sameGeneration(generation, request.expectedGeneration)) {
    return { ok: false, code: "generation_mismatch" };
  }
  context.sims.set(request.floor, prepared.sim);
  context.artifacts.set(request.floor, prepared.artifact);
  return { ok: true, floor: request.floor, generation };
}

function invalidFloor(floor: number): boolean {
  return floor < 1 || floor > FLOOR_CAP || !Number.isInteger(floor);
}

function hasLivePlayers(sim: GameSim | undefined): boolean {
  return Boolean(sim?.playerCount);
}

function floorIsBusy(context: FloorRegistryApplyContext, floor: number): boolean {
  return context.inFlightPreparations.has(floor) || context.transferQueue.hasWorkForFloor(floor);
}

function validTerritoryRoster(config: FloorGenerationConfig | undefined): boolean {
  return !config?.territoryRoster || config.territoryRoster.length >= 4 && config.territoryRoster.length <= 12 &&
    config.territoryRoster.every(isTerritoryId);
}

function currentGeneration(sim: GameSim): FloorGenerationIdentity {
  if (!sim.world.floorIdentity) throw new Error("Applied finite floor has no generation identity");
  return sim.world.floorIdentity;
}

function sameGeneration(a: FloorGenerationIdentity, b: FloorGenerationIdentity): boolean {
  return a.seed === b.seed && a.generatorVersion === b.generatorVersion && a.retryIndex === b.retryIndex &&
    a.configurationFingerprint === b.configurationFingerprint && a.fingerprint === b.fingerprint &&
    JSON.stringify(a.bounds) === JSON.stringify(b.bounds);
}
