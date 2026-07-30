import {
  type AreaSystem,
  type ClientInput,
  type ClientMessage,
  type ContentRegistry,
  type Entity,
  type EffectsEngine,
  type GameEvent,
  type InvStack,
  type NetworkProfile,
  type Rng,
  type SnapshotMode,
  type World,
} from "@dc2d/engine";
import type { PlayerStore, StoredPlayer } from "../../store.js";
import type { EnemySlot } from "./enemyState.js";
import type {
  SnapshotClientState,
  SnapshotEntityState,
  SnapshotPendingState,
} from "./snapshotState.js";
import type { HandicapGrant } from "../progression/handicap.js";
import type { PetSlot } from "../pets/types.js";
import type {
  FloorTransferRequest,
  LootChest,
  ModerationReport,
  Party,
  PendingTransfer,
  ReviveAttempt,
  WorldEvent,
} from "./domainTypes.js";

export type {
  FloorArrivalKind,
  FloorTransferRequest,
  JoinResult,
  LootChest,
  ModerationReport,
  Party,
  PendingTransfer,
  ReviveAttempt,
  WorldEvent,
} from "./domainTypes.js";

/**
 * Shared state contract for the floor simulation. Every sim/ module is
 * a set of pure-ish functions over this one mutable state object; the
 * GameSim facade (index.ts) owns the instance and the tick order.
 */

/** Everything a client can ask for besides movement and handshakes. */
export type PlayerAction = Exclude<
  ClientMessage,
  ClientInput | { type: "hello" } | { type: "ping" } |
  { type: "snapshotResync" } | { type: "networkProfile" }
>;

export interface PlayerSlot {
  entity: Entity;
  clientId: string;
  stored: StoredPlayer;
  resumeToken: string;
  lastSeq: number;
  /** Highest sequence accepted from the current socket epoch, including unprocessed input. */
  highestReceivedSeq?: number;
  /** Last client-projected simulation tick completed by the authoritative player step. */
  lastProjectedServerTick?: number;
  /** Control state held after consuming every command due for the simulated input tick. */
  heldInput?: ClientInput;
  /** Last authoritative tick that accepted movement input for the CorpNet lease. */
  lastInputReceivedAtTick?: number;
  pendingInputs: ClientInput[];
  pendingActions: PlayerAction[];
  connected: boolean;
  /** Tick control was lost; reconnect uses it to pause lifecycle deadlines. */
  disconnectedAtTick?: number | null;
  reapAtTick: number;
  known: Set<string>;
  /** Unlimited inventory: one stack per item def, pruned at qty 0. */
  inventory: InvStack[];
  /** Quick-use bar: item def bound per slot (qty lives in inventory). */
  hotbar: Array<string | null>;
  /** Equipped weapon def; null = fists. Melee swings read this. */
  weapon: string | null;
  /** GAME-2 resources are optional only for legacy unit-test fixtures. New live
   * slots initialize them eagerly in join.ts. */
  stamina?: number;
  maxStamina?: number;
  blocking?: boolean;
  staminaRecoveryDelaySeconds?: number;
  staminaExhausted?: boolean;
  lastDamageAtTick?: number;
  /** Most recent authoritative hostile source, including delayed status damage. */
  lastDamageSourceId?: string;
  lastDamagedByPlayerId?: string | null;
  /** Private per-player events (toasts, stash contents, invites…). */
  outbox: GameEvent[];
  /** Where DoorExit leads, innermost last — portals nest (world → safe room → personal). */
  returnStack: Array<{ x: number; y: number; z: number }>;
  partyId: string | null;
  /** Session-persistent social safety controls, replayed on reconnect. */
  mutedPlayers?: Set<string>;
  blockedPlayers?: Set<string>;
  respawnAtTick: number | null;
  /** Send the full area set on next snapshot (join/teleport). */
  needsFullAreas: boolean;
  /** AOI center included in the last committed snapshot for area backfill. */
  lastAreaAoiCenter?: AoiCenter;
  downedAtTick: number | null;
  /** Melee swings gate on this tick (spam clicks are dropped). */
  attackReadyAtTick: number;
  /** Most recent accepted swing, replicated briefly for peer animation. */
  attackStartedAtTick: number;
  /** Dev harness: full heal + no knockback every tick (debugCommands only). */
  god: boolean;
  /** Optional incoming-damage grant; name/admin resolution lives in handicap.ts. */
  handicap?: HandicapGrant;
  /** Menu-requested death bypasses the party downed state. */
  forceDeath: boolean;
  /** Authoritative tick when another accepted stuck-player rescue is allowed. */
  rescueReadyAtTick?: number;
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
  /** Optional delivery profile follows this slot across reconnects and floors. */
  networkProfile?: NetworkProfile;
}

export interface AoiCenter {
  readonly x: number;
  readonly y: number;
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
    /** Test-only torch lifetime override; production uses TORCH_BURN_TICKS. */
    torchBurnTicks?: number;
    testFixtures?: boolean;
  };
  readonly players: Map<string, PlayerSlot>;
  readonly byToken: Map<string, string>;
  readonly enemies: Map<string, EnemySlot>;
  /** Friendly, non-combat companions; behavior lives in sim/pets. */
  readonly pets: Map<string, PetSlot>;
  readonly items: Map<string, Entity>;
  readonly lootChests: Map<string, LootChest>;
  readonly projectiles: Map<string, Entity>;
  /** Thrown torches, flying and placed — see sim/torches.ts. Ephemeral:
   * ASSUMPTION #41 (docs/ASSUMPTIONS.md), not persisted across restart. */
  readonly torches: Map<string, Entity>;
  readonly parties: Map<string, Party>;
  readonly invites: Map<string, { from: string; expiresAt: number }>;
  /** Bounded in-memory audit queue awaiting a production moderation sink. */
  readonly moderationReports: ModerationReport[];
  /** Pending fistbump offers, keyed by target entity id (Epic 7.10) — 10s window. */
  readonly fistbumpOffers: Map<string, { from: string; expiresAtTick: number }>;
  readonly reviveAttempts: Map<string, ReviveAttempt>;
  readonly activatedChunks: Set<string>;
  readonly defeatedMiniBossArenas: Set<string>;
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
  crossFloorDirectory: ReadonlyArray<{ name: string; floor: number; profileId?: string }>;
  /** Global chat events awaiting FloorRegistry relay to every OTHER
   * active floor sim (this sim's own players already got it directly —
   * see social.ts's doGlobalChat). Drained once per tick by the registry. */
  pendingGlobalChat: GameEvent[];
  /** Transport-only delta caches, isolated from authoritative gameplay state. */
  readonly snapshotClients: Map<string, SnapshotClientState>;
  readonly snapshotEntities: Map<string, SnapshotEntityState>;
  readonly snapshotPending: Map<string, SnapshotPendingState>;
  /** Last authoritative horizontal displacement per second, for remote extrapolation only. */
  readonly replicationMotion: Map<string, { x: number; y: number }>;
}

export type { EnemySlot } from "./enemyState.js";
export { createSimState } from "./stateFactory.js";
