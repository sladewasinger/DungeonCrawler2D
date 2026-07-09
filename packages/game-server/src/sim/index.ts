import {
  TICK_DT,
  type AreaSystem,
  type ClientInput,
  type ContentRegistry,
  type EffectEvent,
  type EffectsEngine,
  type Entity,
  type InvSlot,
  type ServerSnapshot,
  type World,
} from "@dc2d/engine";
import { PlayerStore } from "../store";
import { processActions } from "./actions";
import { resolveDeaths } from "./deaths";
import { activateChunksNearPlayers, stepEnemies } from "./enemies";
import { spawnEnemy, spawnItem } from "./helpers";
import {
  addPlayer,
  applyGodMode,
  handleInput,
  markDisconnected,
  queueAction,
  reapAndRespawn,
  stepPlayers,
} from "./players";
import { stepProjectiles } from "./projectiles";
import { buildSnapshots } from "./snapshots";
import { expireInvites } from "./social";
import { createSimState, type JoinResult, type PlayerAction, type SimState } from "./state";
import { applyAreaContact, realizeEffectEvents, tickStatuses } from "./statuses";
import { HAZARD_RESEED_TICKS, seedTestZoneHazards } from "./testzone";

export type { JoinResult, PlayerAction } from "./state";

/**
 * The authoritative floor simulation — a facade over the sim/ modules,
 * which all operate on one shared SimState. Still transport-free:
 * server.ts feeds it validated messages and ships out the snapshots;
 * integration tests drive it directly. The tick order lives in step().
 */
export class GameSim {
  private readonly state: SimState;

  constructor(
    world: World,
    content: ContentRegistry,
    store: PlayerStore = new PlayerStore(null),
    rngSeed = 1,
    opts: {
      /** e2e scaffolding: spawn players together at the proving ground. */
      clusterSpawns?: boolean;
      /** Dev harness: accept debug intents (god, teleport). NEVER in prod. */
      debugCommands?: boolean;
    } = {},
  ) {
    this.state = createSimState(world, content, store, rngSeed, opts);
  }

  get world(): World {
    return this.state.world;
  }

  get effects(): EffectsEngine {
    return this.state.effects;
  }

  get areas(): AreaSystem {
    return this.state.areas;
  }

  get tick(): number {
    return this.state.tickCount;
  }

  get playerCount(): number {
    return this.state.players.size;
  }

  get enemyCount(): number {
    return this.state.enemies.size;
  }

  // ── join / leave / input ─────────────────────────────────────────

  addPlayer(name: string, clientId: string, resumeToken?: string): JoinResult {
    return addPlayer(this.state, name, clientId, resumeToken);
  }

  markDisconnected(playerId: string): void {
    markDisconnected(this.state, playerId);
  }

  handleInput(playerId: string, input: ClientInput): void {
    handleInput(this.state, playerId, input);
  }

  queueAction(playerId: string, msg: PlayerAction): void {
    queueAction(this.state, playerId, msg);
  }

  getPlayerEntity(playerId: string): Entity | undefined {
    return this.state.players.get(playerId)?.entity;
  }

  getInventory(playerId: string): InvSlot[] | undefined {
    return this.state.players.get(playerId)?.inventory;
  }

  /** Test access: spawn an item entity on the ground. */
  spawnItem(defId: string, x: number, y: number, qty = 1): Entity {
    return spawnItem(this.state, defId, x, y, qty);
  }

  /** Test access: spawn an enemy. */
  spawnEnemy(defId: string, x: number, y: number): Entity {
    return spawnEnemy(this.state, defId, x, y);
  }

  // ── main tick ────────────────────────────────────────────────────

  step(): Map<string, ServerSnapshot> {
    const sim = this.state;
    sim.tickCount++;
    const effectEvents: EffectEvent[] = [];

    reapAndRespawn(sim);
    stepPlayers(sim, effectEvents);
    processActions(sim, effectEvents);
    activateChunksNearPlayers(sim);
    if (sim.hazardsActive && sim.tickCount % HAZARD_RESEED_TICKS === 0) {
      seedTestZoneHazards(sim);
    }
    stepEnemies(sim, effectEvents);
    stepProjectiles(sim, effectEvents);
    sim.areas.tick(TICK_DT, () => sim.rng.next());
    applyAreaContact(sim, effectEvents);
    tickStatuses(sim, effectEvents);
    realizeEffectEvents(sim, effectEvents);
    applyGodMode(sim); // dev harness — undoes the tick's damage before deaths
    resolveDeaths(sim);
    expireInvites(sim);

    return buildSnapshots(sim);
  }
}
