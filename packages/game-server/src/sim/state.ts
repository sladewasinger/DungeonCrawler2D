import {
  AreaSystem,
  EffectsEngine,
  Rng,
  type ClientInput,
  type ClientMessage,
  type ContentRegistry,
  type EnemyBrain,
  type EnemyAnimationState,
  type EnemyDef,
  type Entity,
  type GameEvent,
  type InvStack,
  type SnapshotMode,
  type World,
} from "@dc2d/engine";
import { PlayerStore, type StoredPlayer } from "../store.js";
import type { SnapshotClientState, SnapshotEntityState } from "./snapshotState.js";

/**
 * Shared state contract for the floor simulation. Every sim/ module is
 * a set of pure-ish functions over this one mutable state object; the
 * GameSim facade (index.ts) owns the instance and the tick order.
 */

/** Everything a client can ask for besides movement and handshakes. */
export type PlayerAction = Exclude<
  ClientMessage,
  ClientInput | { type: "hello" } | { type: "ping" } | { type: "snapshotResync" }
>;

/**
 * Epic 7.14 (The Descent) — how a slot is arriving at its target floor:
 * at the target's up-stair (descending), its down-stair (ascending), or
 * a fresh death respawn (always floor 1, ignores stairways entirely).
 */
export type FloorArrivalKind = "stairUp" | "stairDown" | "deathSpawn";

export interface PendingTransfer {
  targetFloor: number;
  arrival: FloorArrivalKind;
}

/** A transfer ready to leave its source sim, carrying the slot itself
 * (the "same slot-move machinery" — the object just changes which
 * SimState's `players` map holds it). */
export interface FloorTransferRequest extends PendingTransfer {
  slot: PlayerSlot;
}

export interface PlayerSlot {
  entity: Entity;
  clientId: string;
  stored: StoredPlayer;
  resumeToken: string;
  lastSeq: number;
  pendingInputs: ClientInput[];
  pendingActions: PlayerAction[];
  connected: boolean;
  reapAtTick: number;
  known: Set<string>;
  /** Unlimited inventory: one stack per item def, pruned at qty 0. */
  inventory: InvStack[];
  /** Quick-use bar: item def bound per slot (qty lives in inventory). */
  hotbar: Array<string | null>;
  /** Equipped weapon def; null = fists. Melee swings read this. */
  weapon: string | null;
  /** Private per-player events (toasts, stash contents, invites…). */
  outbox: GameEvent[];
  /** Where DoorExit leads, innermost last — portals nest (world → safe room → personal). */
  returnStack: Array<{ x: number; y: number; z: number }>;
  partyId: string | null;
  respawnAtTick: number | null;
  /** Send the full area set on next snapshot (join/teleport). */
  needsFullAreas: boolean;
  downedAtTick: number | null;
  /** Melee swings gate on this tick (spam clicks are dropped). */
  attackReadyAtTick: number;
  /** Most recent accepted swing, replicated briefly for peer animation. */
  attackStartedAtTick: number;
  /** Dev harness: full heal + no knockback every tick (debugCommands only). */
  god: boolean;
  /** Menu-requested death bypasses the party downed state. */
  forceDeath: boolean;
  /** Tick timestamps of recent chat sends, rolling-window rate limit (social.ts). */
  chatTimestamps: number[];
  /** Tick of this slot's most recent fistbump *offer* sent, rate-limited separately from chat. */
  lastFistbumpOfferAtTick: number;
  /** Spawn-grace protection holds while tickCount < this (0 = none) —
   * set at every fresh-spawn handoff, see sim/spawnSafety.ts. */
  spawnGraceUntilTick: number;
  /** Epic 7.14 (The Descent): set by a stairway `descend` intent or a
   * non-floor-1 death respawn; drained at the tail of GameSim.step() —
   * see floors/transfer.ts. */
  pendingTransfer: PendingTransfer | null;
  /** Negotiated wire mode follows this slot across floor transfers. */
  snapshotMode?: SnapshotMode;
}

export interface EnemySlot {
  entity: Entity;
  brain: EnemyBrain;
  def: EnemyDef;
  animation: {
    state: EnemyAnimationState;
    ticksRemaining: number;
    target?: { x: number; y: number; z: number };
  };
}

export interface Party {
  id: string;
  members: Set<string>;
  roomSlot: number | null;
}

export interface JoinResult {
  playerId: string;
  resumeToken: string;
  spawn: { x: number; y: number; z: number };
  resumed: boolean;
  /** Epic 7.14 (The Descent): the floor this join/resume landed on — the
   * server.ts caller reads this into the welcome message's `floor`. */
  floor: number;
}

/** A game event pinned to a world position for AOI-scoped delivery. */
export interface WorldEvent {
  ev: GameEvent;
  x: number;
  y: number;
}

export interface SimState {
  readonly world: World;
  readonly content: ContentRegistry;
  readonly store: PlayerStore;
  readonly rng: Rng;
  readonly effects: EffectsEngine;
  readonly areas: AreaSystem;
  readonly opts: {
    /** e2e scaffolding: spawn players together at the proving ground. */
    clusterSpawns?: boolean;
    /**
     * Gameplay mode: keep every spawn (and respawn) within this many tiles
     * of a seed-derived anchor near the world origin, spaced apart from
     * other players. `undefined`/`0` = classic vast MIN_SPAWN_DIST scatter.
     * Distinct from `clusterSpawns`, which is a tight fixed-grid e2e/test
     * mode and always wins if both are set — see sim/spawn.ts.
     */
    spawnRadiusTiles?: number | undefined;
    /** Dev harness: accept debug intents (god, teleport). NEVER in prod. */
    debugCommands?: boolean;
    /** Temporary playtest switch: keep populated hostiles visible but inert. */
    freezeEnemies?: boolean;
    testFixtures?: boolean;
  };
  readonly players: Map<string, PlayerSlot>;
  readonly byToken: Map<string, string>;
  readonly enemies: Map<string, EnemySlot>;
  readonly items: Map<string, Entity>;
  readonly projectiles: Map<string, Entity>;
  /** Thrown torches, flying and placed — see sim/torches.ts. Ephemeral:
   * ASSUMPTION #41 (docs/ASSUMPTIONS.md), not persisted across restart. */
  readonly torches: Map<string, Entity>;
  readonly parties: Map<string, Party>;
  readonly invites: Map<string, { from: string; expiresAt: number }>;
  /** Pending fistbump offers, keyed by target entity id (Epic 7.10) — 10s window. */
  readonly fistbumpOffers: Map<string, { from: string; expiresAtTick: number }>;
  readonly activatedChunks: Set<string>;
  /** Fire-exposure seconds per ground item id (items char, then burn away). */
  readonly exposure: Map<string, number>;
  /** Positional events delivered to anyone whose AOI covers (x, y). */
  worldEvents: WorldEvent[];
  tickCount: number;
  nextPartyId: number;
  nextPartyRoom: number;
  /** True once the test-zone chunk activated — keeps hazard fixtures seeded. */
  hazardsActive: boolean;

  // ── Epic 7.14 (The Descent) ─────────────────────────────────────────
  /** Slots that left this sim this tick, awaiting FloorRegistry placement
   * into their target floor's sim next tick — see floors/transfer.ts. */
  outgoingTransfers: FloorTransferRequest[];
  /** True while a player has engaged the floor-5 boss and it's still
   * alive — the arena boundary is enforced (floors/boss.ts) only then. */
  bossGateSealed: boolean;
  /** Player ids inside the ring at the instant it sealed — fixed for the
   * seal's duration, so the boundary clamp knows which direction "in"
   * is for each player (insiders trapped in, outsiders locked out). */
  readonly bossArenaOccupants: Set<string>;
  /** Tick the Warden may respawn, or null while it's alive. */
  bossRespawnAtTick: number | null;
  /** Set by FloorRegistry each tick for sims under its management: every
   * connected player across every active floor, for cross-floor /who
   * (contacts.ts) and global chat relay (social.ts). Empty for sims not
   * under a registry (sandbox, bare unit tests) — those fall back to
   * this sim's own `players` map. */
  crossFloorDirectory: ReadonlyArray<{ name: string; floor: number }>;
  /** Global chat events awaiting FloorRegistry relay to every OTHER
   * active floor sim (this sim's own players already got it directly —
   * see social.ts's doGlobalChat). Drained once per tick by the registry. */
  pendingGlobalChat: GameEvent[];
  /** Transport-only delta caches, isolated from authoritative gameplay state. */
  readonly snapshotClients: Map<string, SnapshotClientState>;
  readonly snapshotEntities: Map<string, SnapshotEntityState>;
}

export function createSimState(
  world: World,
  content: ContentRegistry,
  store: PlayerStore,
  rngSeed: number,
  opts: SimState["opts"],
): SimState {
  return {
    world, content, store,
    rng: new Rng(rngSeed),
    effects: new EffectsEngine(content, (x, y) => world.isSanctuary(x, y)),
    areas: new AreaSystem(content, world),
    opts,
    players: new Map(),
    byToken: new Map(),
    enemies: new Map(),
    items: new Map(),
    projectiles: new Map(),
    torches: new Map(),
    parties: new Map(),
    invites: new Map(),
    fistbumpOffers: new Map(),
    activatedChunks: new Set(),
    exposure: new Map(),
    worldEvents: [],
    tickCount: 0,
    nextPartyId: 1,
    nextPartyRoom: 0,
    hazardsActive: false,
    outgoingTransfers: [],
    bossGateSealed: false,
    bossArenaOccupants: new Set(),
    bossRespawnAtTick: null,
    crossFloorDirectory: [],
    pendingGlobalChat: [],
    snapshotClients: new Map(),
    snapshotEntities: new Map(),
  };
}
