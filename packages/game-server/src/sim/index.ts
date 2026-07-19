import {
  TICK_DT,
  type AreaSystem,
  type ClientInput,
  type ContentRegistry,
  type EffectEvent,
  type EffectsEngine,
  type Entity,
  type InvStack,
  type ServerSnapshot,
  type World,
} from "@dc2d/engine";
import { processActions } from "./actions/index.js";
import { resolveDeaths } from "./deaths.js";
import { activateChunksNearPlayers, stepEnemies } from "./enemies/index.js";
import { spawnEnemy, spawnItem } from "./helpers.js";
import { addPlayer } from "./join.js";
import {
  applyGodMode,
  handleInput,
  markDisconnected,
  queueAction,
  reapAndRespawn,
  stepPlayers,
} from "./players.js";
import { stepProjectiles } from "./projectiles.js";
import { buildSnapshots } from "./snapshots.js";
import { expireInvites } from "./social.js";
import { createSimState, type JoinResult, type PlayerAction, type SimState } from "./state.js";
import { applyAreaContact, realizeEffectEvents, tickStatuses } from "./statuses.js";
import { TEST_ZONE_RESEED_TICKS, seedTestZoneHazards, seedTestZoneItems } from "./testzone.js";
import { PlayerStore } from "../store.js";

export type { JoinResult, PlayerAction } from "./state.js";

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
      /** Gameplay mode: cluster spawns within N tiles of a seed anchor — see state.ts's opts doc. */
      spawnRadiusTiles?: number | undefined;
      /** Dev harness: accept debug intents (god, teleport). NEVER in prod. */
      debugCommands?: boolean;
      testFixtures?: boolean;
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

  getInventory(playerId: string): InvStack[] | undefined {
    return this.state.players.get(playerId)?.inventory;
  }

  getHotbar(playerId: string): Array<string | null> | undefined {
    return this.state.players.get(playerId)?.hotbar;
  }

  getWeapon(playerId: string): string | null | undefined {
    return this.state.players.get(playerId)?.weapon;
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
    if (sim.hazardsActive && sim.tickCount % TEST_ZONE_RESEED_TICKS === 0) {
      const claimed = new Set<string>();
      seedTestZoneHazards(sim, claimed);
      seedTestZoneItems(sim, claimed);
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
