import {
  DEFAULT_WORLD_FEATURES,
  snapshotWorldFeatures,
} from "@dc2d/engine";
import type { GameSim } from "../sim/core/index.js";
import { FLOOR_CAP } from "../sim/floors/index.js";
import { collectSnapshots, refreshDirectory, relayGlobalChat } from "./floorRegistryReplication.js";
import { measureServerWork } from "../server/runtime/runtimeWork.js";
import { FloorPreparationQueue } from "./preparation/floorPreparationQueue.js";
import { FloorPreparationWorkerClient } from "./floorPreparationWorkerClient.js";
import {
  clampFloor,
  createInitialFloor,
  type FloorPreparationContext,
  type PreparedFloorRequest,
} from "./floorRegistryPreparation.js";
import type { FloorRegistryCreation, PreparedReplicationTickResult, ReplicationTickResult, TickResult } from "./preparation/floorRegistryTypes.js";
import {
  applyGeneratedFloor,
  type ApplyGeneratedFloorResult,
} from "./registry/floorRegistryApply.js";
import {
  prepareFloor,
  startPrewarm,
} from "./registry/floorRegistryPreparationLifecycle.js";
import { applyTransfers } from "./registry/floorRegistryTransfers.js";
import { createFloorRegistryContexts, type FloorRegistryContexts } from "./registry/floorRegistryContexts.js";

export class FloorRegistry {
  private readonly sims = new Map<number, GameSim>();
  private readonly artifacts = new Map<number, string>();
  private readonly transferQueue = new FloorPreparationQueue();
  private readonly preparationWorker = new FloorPreparationWorkerClient();
  private readonly preparationContext: FloorPreparationContext;
  private readonly inFlightPreparations = new Map<number, Promise<GameSim>>();
  private readonly contexts: FloorRegistryContexts;
  private readonly prewarmEnabled: boolean;

  constructor({ worldSeed, content, store, rngSeedBase, opts, worldFeatures, prewarmNextFloor }: FloorRegistryCreation) {
    const features = snapshotWorldFeatures(worldFeatures ?? DEFAULT_WORLD_FEATURES);
    this.prewarmEnabled = prewarmNextFloor === true;
    this.preparationContext = {
      worldSeed,
      content,
      store,
      rngSeedBase,
      opts,
      worldFeatures: features,
    };
    this.contexts = createFloorRegistryContexts({
      sims: this.sims,
      artifacts: this.artifacts,
      transferQueue: this.transferQueue,
      preparationWorker: this.preparationWorker,
      preparationContext: this.preparationContext,
      inFlightPreparations: this.inFlightPreparations,
    });
    this.ensureFloor(1);
    if (this.prewarmEnabled) this.prewarmFollowing(1);
  }

  get base(): GameSim {
    return this.ensureFloor(1);
  }

  activeSims(): readonly GameSim[] {
    return [...this.sims.values()];
  }

  async waitForPendingFloorPreparations(): Promise<void> {
    await Promise.all([
      this.transferQueue.waitForPending(),
      ...this.inFlightPreparations.values(),
    ]);
  }

  async dispose(): Promise<void> {
    await this.preparationWorker.dispose();
  }

  ensureFloor(floor: number): GameSim {
    return measureServerWork("server.floorEnsure", () => this.ensureFloorInternal(floor));
  }

  private ensureFloorInternal(floor: number): GameSim {
    const clamped = Math.min(Math.max(Math.floor(floor), 1), FLOOR_CAP);
    let sim = this.sims.get(clamped);
    if (!sim) {
      const prepared = createInitialFloor(this.preparationContext, clamped);
      sim = prepared.sim;
      this.sims.set(clamped, sim);
      this.artifacts.set(clamped, prepared.artifact);
    }
    return sim;
  }

  finiteFloorArtifact(floor: number): string | undefined {
    return this.artifacts.get(Math.min(Math.max(Math.floor(floor), 1), FLOOR_CAP));
  }
  async applyGeneratedFloor(
    request: PreparedFloorRequest & { readonly confirm: boolean },
  ): Promise<ApplyGeneratedFloorResult> {
    return applyGeneratedFloor(this.contexts.apply, request);
  }

  findByToken(token: string): GameSim | undefined {
    for (const sim of this.sims.values()) if (sim.hasToken(token)) return sim;
    return undefined;
  }

  joinSim(clientId: string): GameSim {
    return this.ensureFloor(this.preparationContext.store.find(clientId)?.activeFloor ?? 1);
  }

  async prepareJoinSim(clientId: string): Promise<GameSim> {
    const floor = clampFloor(this.preparationContext.store.find(clientId)?.activeFloor ?? 1);
    const existing = this.sims.get(floor);
    if (existing) return existing;
    return this.prepareUnseenFloor(floor);
  }

  stepAll(): TickResult {
    const active = [...this.sims.values()];
    const snapshots = collectSnapshots(active, (sim) => sim.step());
    return { snapshots, moved: this.finishTick(active) };
  }

  stepAllReplicated(): ReplicationTickResult {
    const active = [...this.sims.values()];
    const snapshots = collectSnapshots(active, (sim) => sim.stepReplicated());
    return { snapshots, moved: this.finishTick(active) };
  }

  stepAllPreparedReplicated(): PreparedReplicationTickResult {
    const active = [...this.sims.values()];
    const snapshots = collectSnapshots(active, (sim) => sim.stepPreparedReplicated());
    return { snapshots, moved: this.finishTick(active) };
  }

  private finishTick(active: GameSim[]): TickResult["moved"] {
    relayGlobalChat(active);
    refreshDirectory(active);
    const moved = applyTransfers({
      sims: this.sims,
      transferQueue: this.transferQueue,
      prepare: (floor) => this.prepareUnseenFloor(floor),
    }, active);
    if (this.prewarmEnabled) {
      for (const entry of moved) this.prewarmFollowing(entry.sim.world.floor);
    }
    return moved;
  }

  private prewarmFollowing(floor: number): void {
    const next = floor + 1;
    if (next > FLOOR_CAP) return;
    startPrewarm({ floor: next, prepare: () => this.prepareUnseenFloor(next) });
  }

  private async prepareUnseenFloor(floor: number): Promise<GameSim> {
    return prepareFloor(this.contexts.preparation, floor);
  }
}

export type { ApplyGeneratedFloorResult } from "./registry/floorRegistryApply.js";
