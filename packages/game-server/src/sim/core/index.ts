import {
  type AreaSystem,
  type ClientInput,
  type EffectsEngine,
  type Entity,
  type GameEvent,
  type InvStack,
  type ServerSnapshot,
  type ServerStateSnapshot,
  type SnapshotMode,
  type SpectatorDeathPresentation,
  type World,
} from "@dc2d/engine";
import { initBossFloor, receiveTransfer } from "../floors/index.js";
import { spawnPet as spawnCompanion, type PetDefinition } from "../pets/index.js";
import { spawnEnemy, spawnItem, type ItemSpawn } from "./helpers.js";
import { addPlayer, type PlayerJoinRequest } from "../players/join.js";
import {
  markDisconnected,
  queueAction,
} from "../players/players.js";
import { handleInput } from "../players/playerInputTimeline.js";
import { endSpawnGrace } from "../spawnSafety/spawnSafety.js";
import {
  buildPreparedReplicatedSnapshots,
  buildReplicatedSnapshots,
  buildSnapshots,
  type PreparedSnapshotDelivery,
} from "../snapshots/snapshots.js";
import { configureNetworkProfile, configureSnapshotMode, requestSnapshotBaseline } from "../snapshots/snapshotReplication.js";
import {
  injectGlobalChat,
  listConnectedPlayers,
  profileIdForPlayer,
} from "../social/socialBridge.js";
import {
  createSimState,
  type FloorTransferRequest,
  type JoinResult,
  type PlayerAction,
  type SimState,
} from "../state/state.js";
import { advanceSimTick } from "./step.js";
import { PlayerStore } from "../../store.js";
import type { GameSimOptions } from "../state/gameSimOptions.js";
import { createGameAdminFacade, type GameAdminFacade } from "../admin/adminFacade.js";
import { visibleDeathPresentationHistory } from "../presentation/deathPresentationHistory.js";

export type { JoinResult, PlayerAction, FloorTransferRequest } from "../state/state.js";

/**
 * The authoritative floor simulation — a facade over the sim/ modules,
 * which all operate on one shared SimState. Still transport-free:
 * server.ts feeds it validated messages and ships out the snapshots;
 * integration tests drive it directly. The tick order lives in step().
 */
export class GameSim {
  private readonly state: SimState;
  readonly admin: GameAdminFacade;

  constructor({
    world,
    content,
    store = new PlayerStore(null),
    rngSeed = 1,
    opts = {},
  }: GameSimOptions) {
    this.state = createSimState({ world, content, store, rngSeed, opts });
    this.admin = createGameAdminFacade(this.state);
    initBossFloor(this.state); // no-op off floor FLOOR_CAP (Epic 7.14)
  }

  get world(): World { return this.state.world; }
  get finiteFloorArtifact(): string | undefined { return this.state.finiteFloorArtifact; } setFiniteFloorArtifact(artifact: string): void { this.state.finiteFloorArtifact = artifact; }
  get effects(): EffectsEngine { return this.state.effects; }

  get areas(): AreaSystem { return this.state.areas; }

  get tick(): number { return this.state.tickCount; }

  get playerCount(): number { return this.state.players.size; }

  get enemyCount(): number { return this.state.enemies.size; }

  get petCount(): number { return this.state.pets.size; }

  get itemCount(): number { return this.state.items.size; }

  get lootChestCount(): number { return this.state.lootChests.size; }


  // ── join / leave / input ─────────────────────────────────────────

  addPlayer(request: PlayerJoinRequest): JoinResult {
    return addPlayer(this.state, request);
  }

  markDisconnected(playerId: string): void {
    markDisconnected(this.state, playerId);
  }

  handleInput(playerId: string, input: ClientInput): boolean {
    return handleInput(this.state, playerId, input);
  }

  queueAction(playerId: string, msg: PlayerAction): boolean {
    return queueAction(this.state, playerId, msg);
  }

  configureSnapshotMode(playerId: string, mode: SnapshotMode | undefined): void {
    configureSnapshotMode(this.state, playerId, mode);
  }

  configureNetworkProfile(playerId: string, profile: Parameters<typeof configureNetworkProfile>[2]): void {
    configureNetworkProfile(this.state, playerId, profile); }

  requestSnapshotBaseline(playerId: string): void { requestSnapshotBaseline(this.state, playerId); }

  getPlayerEntity(playerId: string): Entity | undefined { return this.state.players.get(playerId)?.entity; }

  getInventory(playerId: string): InvStack[] | undefined { return this.state.players.get(playerId)?.inventory; }

  getHotbar(playerId: string): Array<string | null> | undefined { return this.state.players.get(playerId)?.hotbar; }

  getWeapon(playerId: string): string | null | undefined { return this.state.players.get(playerId)?.weapon; }

  visibleDeathPresentations(playerId: string): SpectatorDeathPresentation[] {
    return visibleDeathPresentationHistory(this.state, playerId);
  }

  /** Test access: spawn an item entity on the ground. */
  spawnItem(request: ItemSpawn): Entity {
    return spawnItem(this.state, request);
  }

  /** Test access: spawn an enemy. */
  spawnEnemy(defId: string, x: number, y: number): Entity {
    return spawnEnemy(this.state, { defId, x, y });
  }

  /** Test access: spawn an adoptable pet. */
  spawnPet(definition: PetDefinition, x: number, y: number): Entity {
    return spawnCompanion(this.state, { definition, position: { x, y } });
  }

  /** Test access: forfeit a player's spawn grace (sim/spawnSafety.ts) —
   * combat fixtures hand-place a "long-established" player and expect
   * immediate hostility, without burning SPAWN_GRACE_TICKS of steps. */
  endSpawnGrace(playerId: string): void {
    const slot = this.state.players.get(playerId);
    if (slot) endSpawnGrace(slot);
  }

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
  injectGlobalChat(event: GameEvent, senderProfileId?: string): void {
    injectGlobalChat(this.state, event, senderProfileId); }

  profileIdForPlayer(playerId: string): string | undefined {
    return profileIdForPlayer(this.state, playerId); }

  /** Does a resume token belong to a slot currently in THIS sim? Lets
   * FloorRegistry route a reconnecting "dungeon" hello to the right floor. */
  hasToken(token: string): boolean {
    return this.state.byToken.has(token);
  }

  /** FloorRegistry refreshes this once per tick for cross-floor /who. */
  setCrossFloorDirectory(
    directory: ReadonlyArray<{ name: string; floor: number; profileId?: string }>,
  ): void {
    this.state.crossFloorDirectory = directory;
  }

  /** Presence records for every connected player — FloorRegistry refreshes every sim. */
  listConnectedPlayers(): Array<{ name: string; floor: number; profileId: string }> {
    return listConnectedPlayers(this.state); }

  // ── main tick ────────────────────────────────────────────────────

  step(): Map<string, ServerSnapshot> { this.advanceTick(); return buildSnapshots(this.state); }

  /** Production transport path: negotiated clients receive revision deltas. */
  stepReplicated(): Map<string, ServerStateSnapshot> {
    this.advanceTick();
    return buildReplicatedSnapshots(this.state);
  }

  /** Production path: transport commits each delivery after its socket accepts it. */
  stepPreparedReplicated(): Map<string, PreparedSnapshotDelivery> {
    this.advanceTick();
    return buildPreparedReplicatedSnapshots(this.state);
  }

  private advanceTick(): void {
    advanceSimTick(this.state);
  }
}
