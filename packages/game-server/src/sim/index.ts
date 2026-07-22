import {
  TICK_DT,
  type AreaSystem,
  type ClientInput,
  type ContentRegistry,
  type EffectEvent,
  type EffectsEngine,
  type Entity,
  type GameEvent,
  type InvStack,
  type ServerSnapshot,
  type World,
} from "@dc2d/engine";
import { processActions } from "./actions/index.js";
import { resolveDeaths } from "./deaths.js";
import {
  activateChunksNearPlayers,
  REPOPULATE_INTERVAL_TICKS,
  repopulateNearSpawn,
  stepEnemies,
} from "./enemies/index.js";
import { drainReadyTransfers, initBossFloor, receiveTransfer, stepBoss } from "./floors/index.js";
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
import { expireFistbumpOffers } from "./contacts.js";
import { stepProjectiles } from "./projectiles.js";
import { endSpawnGrace, maintainSpawnClearance } from "./spawnSafety.js";
import { buildSnapshots } from "./snapshots.js";
import { expireInvites } from "./social.js";
import {
  createSimState,
  type FloorTransferRequest,
  type JoinResult,
  type PlayerAction,
  type SimState,
} from "./state.js";
import { applyAreaContact, realizeEffectEvents, tickStatuses } from "./statuses.js";
import { stepTorches } from "./torches.js";
import { TEST_ZONE_RESEED_TICKS, seedTestZoneHazards, seedTestZoneItems } from "./testzone.js";
import { PlayerStore } from "../store.js";

export type { JoinResult, PlayerAction, FloorTransferRequest } from "./state.js";

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
      /** Temporary playtest switch: keep populated hostiles visible but inert. */
      freezeEnemies?: boolean;
      testFixtures?: boolean;
    } = {},
  ) {
    this.state = createSimState(world, content, store, rngSeed, opts);
    initBossFloor(this.state); // no-op off floor FLOOR_CAP (Epic 7.14)
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

  /** Test access: ground-item entities currently in this sim (e.g. a
   * death's full-loot drop, which stays on the floor it happened on). */
  get itemCount(): number {
    return this.state.items.size;
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

  /** Test access: forfeit a player's spawn grace (sim/spawnSafety.ts) —
   * combat fixtures hand-place a "long-established" player and expect
   * immediate hostility, without burning SPAWN_GRACE_TICKS of steps. */
  endSpawnGrace(playerId: string): void {
    const slot = this.state.players.get(playerId);
    if (slot) endSpawnGrace(slot);
  }

  // ── Epic 7.14 (The Descent): cross-sim transfer + cross-floor social ──
  // FloorRegistry (game-server/src/floorRegistry.ts) is the only caller of
  // these — they operate one tick behind step() by design (see
  // floors/transfer.ts's doc comment).

  /** Slots that left this sim THIS tick, awaiting placement elsewhere. */
  takeOutgoingTransfers(): FloorTransferRequest[] {
    const out = this.state.outgoingTransfers;
    this.state.outgoingTransfers = [];
    return out;
  }

  /** Place an arriving slot into this sim. */
  receiveTransfer(req: FloorTransferRequest): void {
    receiveTransfer(this.state, req);
  }

  /** Global chat events this sim's players sent THIS tick, awaiting relay
   * to every other active floor. */
  takePendingGlobalChat(): GameEvent[] {
    const out = this.state.pendingGlobalChat;
    this.state.pendingGlobalChat = [];
    return out;
  }

  /** Deliver a relayed global-chat event to every connected player here. */
  injectGlobalChat(event: GameEvent): void {
    for (const slot of this.state.players.values()) if (slot.connected) slot.outbox.push(event);
  }

  /** Does a resume token belong to a slot currently in THIS sim? Lets
   * FloorRegistry route a reconnecting "dungeon" hello to the right floor. */
  hasToken(token: string): boolean {
    return this.state.byToken.has(token);
  }

  /** FloorRegistry refreshes this once per tick for cross-floor /who. */
  setCrossFloorDirectory(directory: ReadonlyArray<{ name: string; floor: number }>): void {
    this.state.crossFloorDirectory = directory;
  }

  /** Snapshot of `{name, floor}` for every connected player — FloorRegistry's input to setCrossFloorDirectory. */
  listConnectedPlayers(): Array<{ name: string; floor: number }> {
    const floor = this.state.world.floor;
    const out: Array<{ name: string; floor: number }> = [];
    for (const slot of this.state.players.values()) {
      if (slot.connected) out.push({ name: slot.entity.name ?? "?", floor });
    }
    return out;
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
    if (sim.tickCount % REPOPULATE_INTERVAL_TICKS === 0) repopulateNearSpawn(sim);
    if (sim.hazardsActive && sim.tickCount % TEST_ZONE_RESEED_TICKS === 0) {
      const claimed = new Set<string>();
      seedTestZoneHazards(sim, claimed);
      seedTestZoneItems(sim, claimed);
    }
    // Panel round 4 ordering fix (adjacency-at-first-frame race): every
    // enemy population/relocation path this tick — chunk activation,
    // near-spawn repopulation, hazard reseeds, melee knockback from
    // processActions — has run by here, so the graced-radius sweep sees
    // the final pre-movement enemy set. It MUST precede stepEnemies:
    // an evicted camper never gets to think, move, or strike.
    maintainSpawnClearance(sim);
    if (!sim.opts.freezeEnemies) {
      stepEnemies(sim, effectEvents);
      stepProjectiles(sim, effectEvents);
    }
    stepTorches(sim);
    sim.areas.tick(TICK_DT, () => sim.rng.next());
    applyAreaContact(sim, effectEvents);
    tickStatuses(sim, effectEvents);
    realizeEffectEvents(sim, effectEvents);
    applyGodMode(sim); // dev harness — undoes the tick's damage before deaths
    resolveDeaths(sim);
    stepBoss(sim); // Epic 7.14 — no-op off floor FLOOR_CAP
    expireInvites(sim);
    expireFistbumpOffers(sim);
    drainReadyTransfers(sim); // Epic 7.14 — tail of the tick, after everything that could queue one

    return buildSnapshots(sim);
  }
}
