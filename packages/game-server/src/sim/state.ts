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
  type World,
} from "@dc2d/engine";
import { PlayerStore, type StoredPlayer } from "../store.js";

/**
 * Shared state contract for the floor simulation. Every sim/ module is
 * a set of pure-ish functions over this one mutable state object; the
 * GameSim facade (index.ts) owns the instance and the tick order.
 */

/** Everything a client can ask for besides movement and handshakes. */
export type PlayerAction = Exclude<
  ClientMessage,
  ClientInput | { type: "hello" } | { type: "ping" }
>;

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
    /** Dev harness: accept debug intents (god, teleport). NEVER in prod. */
    debugCommands?: boolean;
    testFixtures?: boolean;
  };
  readonly players: Map<string, PlayerSlot>;
  readonly byToken: Map<string, string>;
  readonly enemies: Map<string, EnemySlot>;
  readonly items: Map<string, Entity>;
  readonly projectiles: Map<string, Entity>;
  readonly parties: Map<string, Party>;
  readonly invites: Map<string, { from: string; expiresAt: number }>;
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
}

export function createSimState(
  world: World,
  content: ContentRegistry,
  store: PlayerStore,
  rngSeed: number,
  opts: SimState["opts"],
): SimState {
  return {
    world,
    content,
    store,
    rng: new Rng(rngSeed),
    effects: new EffectsEngine(content, (x, y) => world.isSanctuary(x, y)),
    areas: new AreaSystem(content, world),
    opts,
    players: new Map(),
    byToken: new Map(),
    enemies: new Map(),
    items: new Map(),
    projectiles: new Map(),
    parties: new Map(),
    invites: new Map(),
    activatedChunks: new Set(),
    exposure: new Map(),
    worldEvents: [],
    tickCount: 0,
    nextPartyId: 1,
    nextPartyRoom: 0,
    hazardsActive: false,
  };
}
