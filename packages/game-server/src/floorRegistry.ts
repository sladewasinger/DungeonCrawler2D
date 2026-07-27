import {
  LEVEL,
  World,
  type ContentRegistry,
  type ServerSnapshot,
  type ServerStateSnapshot,
} from "@dc2d/engine";
import { GameSim } from "./sim/index.js";
import type { PreparedSnapshotDelivery } from "./sim/snapshots.js";
import { FLOOR_CAP } from "./sim/floors/index.js";
import { PlayerStore } from "./store.js";

/**
 * Owns the "dungeon" level's per-floor GameSim instances (Epic 7.14 —
 * The Descent). Floor 1 always exists at construction (it IS the
 * pre-existing base dungeon sim, no migration weirdness); floors
 * 2..FLOOR_CAP are created lazily on first entry, all sharing this
 * process's PlayerStore/content/worldSeed. server.ts steps this once per
 * tick instead of a single GameSim for the "dungeon" level.
 */
export interface FloorRegistryOptions {
  clusterSpawns?: boolean;
  spawnRadiusTiles?: number | undefined;
  debugCommands?: boolean;
  testFixtures?: boolean;
}

export interface FloorRegistryCreation {
  worldSeed: number;
  content: ContentRegistry;
  store: PlayerStore;
  rngSeedBase: number;
  opts: FloorRegistryOptions;
}

export interface TickResult {
  snapshots: Map<string, ServerSnapshot>;
  /** Players whose socket must now route to a different sim. */
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

export class FloorRegistry {
  private readonly sims = new Map<number, GameSim>();

  constructor({ worldSeed, content, store, rngSeedBase, opts }: FloorRegistryCreation) {
    this.worldSeed = worldSeed;
    this.content = content;
    this.store = store;
    this.rngSeedBase = rngSeedBase;
    this.opts = opts;
    this.ensureFloor(1);
  }

  private readonly worldSeed: number;
  private readonly content: ContentRegistry;
  private readonly store: PlayerStore;
  private readonly rngSeedBase: number;
  private readonly opts: FloorRegistryOptions;

  /** The always-existing floor-1 sim — RunningServer.sims.dungeon aliases this. */
  get base(): GameSim {
    return this.ensureFloor(1);
  }

  ensureFloor(floor: number): GameSim {
    const clamped = Math.min(Math.max(Math.floor(floor), 1), FLOOR_CAP);
    let sim = this.sims.get(clamped);
    if (!sim) {
      sim = new GameSim({ world: new World(this.worldSeed, clamped, LEVEL.Dungeon), content: this.content, store: this.store, rngSeed: this.rngSeedBase + clamped, opts: this.opts }
      );
      this.sims.set(clamped, sim);
    }
    return sim;
  }

  /** Which currently-active floor sim (if any) holds a resume token. */
  findByToken(token: string): GameSim | undefined {
    for (const sim of this.sims.values()) if (sim.hasToken(token)) return sim;
    return undefined;
  }

  /** Authoritative destination for a non-resume dungeon hello. The client
   * cannot select a floor; an existing character returns to its durable
   * active floor and a new character starts on floor 1. */
  joinSim(clientId: string): GameSim {
    return this.ensureFloor(this.store.find(clientId)?.activeFloor ?? 1);
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
    return this.applyTransfers(active);
  }

  private applyTransfers(active: GameSim[]): TickResult["moved"] {
    const moved: TickResult["moved"] = [];
    for (const sim of active) {
      for (const req of sim.takeOutgoingTransfers()) {
        const dest = this.ensureFloor(req.targetFloor);
        dest.receiveTransfer(req);
        moved.push({ playerId: req.slot.entity.id, sim: dest });
      }
    }
    return moved;
  }
}

function collectSnapshots<T>(
  active: GameSim[],
  step: (sim: GameSim) => Map<string, T>,
): Map<string, T> {
  const snapshots = new Map<string, T>();
  for (const sim of active) {
    for (const [id, snapshot] of step(sim)) snapshots.set(id, snapshot);
  }
  return snapshots;
}

/** Relay each floor's global-chat events to every OTHER active floor
 * (ASSUMPTION #130: one tick of relay delay, docs/ASSUMPTIONS.md). */
function relayGlobalChat(active: GameSim[]): void {
  const perSim = active.map((sim) => ({ sim, events: sim.takePendingGlobalChat() }));
  for (const origin of perSim) {
    relayOriginChat(origin, perSim);
  }
}

type ChatRelaySource = { sim: GameSim; events: ReturnType<GameSim["takePendingGlobalChat"]> };

function relayOriginChat(origin: ChatRelaySource, destinations: ChatRelaySource[]): void {
  if (origin.events.length === 0) return;
  for (const destination of destinations) relayToOtherSim(origin, destination);
}

function relayToOtherSim(origin: ChatRelaySource, destination: ChatRelaySource): void {
  if (destination.sim === origin.sim) return;
  for (const event of origin.events) {
    destination.sim.injectGlobalChat(event, senderProfileIdFor(origin.sim, event));
  }
}

function senderProfileIdFor(sim: GameSim, event: ChatRelaySource["events"][number]): string | undefined {
  return event.t === "chat" ? sim.profileIdForPlayer(event.from) : undefined;
}

/** Refresh every active floor's cross-floor /who directory. */
function refreshDirectory(active: GameSim[]): void {
  const directory = active.flatMap((sim) => sim.listConnectedPlayers());
  for (const sim of active) sim.setCrossFloorDirectory(directory);
}
