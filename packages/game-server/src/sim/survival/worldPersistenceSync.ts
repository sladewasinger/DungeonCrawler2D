/** Hydration and persistence export coordinator linking WorldSim, Harvester, Structures, and LootManager. */
import { DEFAULT_APPEARANCE, sanitizeCharacterAppearance, type CharacterAppearance, type PlayerInventoryState } from "@dc2d/engine";
import { issuePlayerCredentials, verifyResumeToken } from "../../net/playerAuth.js";
import { createCombatState, type PlayerCombatState } from "../combatActions.js";
import { createStarterInventory } from "../playerInventory.js";
import { normalizeOwnerKey, type SavedBedBinding } from "./campStructures.js";
import type { PersistedPlayerRecord, PersistedWorldFile, WorldPersistenceStore } from "./persistenceStore.js";
import { applySavedPlayerRecord, buildPersistedPlayerList, indexSavedPlayers, toPersistedPlayerRecord, type PersistablePlayerInput } from "./playerSurvivalState.js";
import type { WorldSim } from "../worldSim.js";

export interface SimPlayer {
  readonly id: string; readonly accountId: string; readonly tokenHash?: string | undefined; name: string; appearance: CharacterAppearance;
  x: number; y: number; elevation: number; facingX: number; facingY: number; aimX: number; aimY: number; hasExplicitAim: boolean;
  jumpZ: number; jumpVz: number; jumpQueued: boolean; moveX: number; moveY: number; moving: boolean; sprinting: boolean; crouching: boolean;
  stealthVis: number; inCover: boolean; noiseRadius: number; visibility: number; sprintNoiseAcc: number; attackFlashTimer: number;
  torchLit: boolean; inWater: boolean; inDeepWater: boolean; lastAckSeq: number; lastActionAckSeq: number;
  selectedHotbar: number; inventory: PlayerInventoryState; attackQueued: boolean; attackHold: boolean; bowDrawing: boolean;
  bowReleaseQueued: boolean; blockHeld: boolean; dodgeQueued: boolean; dodgeDirX: number | undefined; dodgeDirY: number | undefined;
  throwPebbleQueued: boolean; interactQueued: boolean; readonly combat: PlayerCombatState; profileHydrated: boolean;
}

export function createInitialSimPlayer(opts: {
  readonly id: string; readonly accountId: string; readonly tokenHash?: string | undefined;
  readonly name: string; readonly appearance?: CharacterAppearance | undefined; readonly activeCount: number;
}): SimPlayer {
  const offset = ((opts.activeCount % 4) - 1.5) * 0.6;
  return {
    id: opts.id, accountId: opts.accountId, ...(opts.tokenHash ? { tokenHash: opts.tokenHash } : {}),
    name: opts.name, appearance: sanitizeCharacterAppearance(opts.appearance ?? DEFAULT_APPEARANCE),
    x: 0.5 + offset, y: 0.5, elevation: 0, facingX: 0, facingY: 1, aimX: 0, aimY: 1, hasExplicitAim: false,
    jumpZ: 0, jumpVz: 0, jumpQueued: false, moveX: 0, moveY: 0, moving: false, sprinting: false, crouching: false,
    stealthVis: 0.7, inCover: false, noiseRadius: 0.5, visibility: 0.7, sprintNoiseAcc: 0, attackFlashTimer: 0,
    torchLit: true, inWater: false, inDeepWater: false, lastAckSeq: 0, lastActionAckSeq: 0,
    selectedHotbar: 0, inventory: createStarterInventory(), attackQueued: false, attackHold: false, bowDrawing: false,
    bowReleaseQueued: false, blockHeld: false, dodgeQueued: false, dodgeDirX: undefined, dodgeDirY: undefined,
    throwPebbleQueued: false, interactQueued: false, combat: createCombatState(), profileHydrated: false,
  };
}

export interface PersistenceHost {
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly store: WorldPersistenceStore;
}

export interface SessionAuthResult {
  readonly accountId: string;
  readonly tokenHash: string;
  readonly issuedCredentials?: { readonly accountId: string; readonly resumeToken: string } | undefined;
}

export function resolveSessionAuth(opts: {
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly accountId?: string | undefined;
  readonly resumeToken?: string | undefined;
}): SessionAuthResult {
  const existing = opts.accountId ? opts.savedProfiles.get(opts.accountId) : undefined;
  if (existing?.tokenHash && opts.accountId && verifyResumeToken(opts.resumeToken, existing.tokenHash)) {
    return { accountId: opts.accountId, tokenHash: existing.tokenHash };
  }
  const issued = issuePlayerCredentials();
  return {
    accountId: issued.accountId,
    tokenHash: issued.tokenHash,
    issuedCredentials: { accountId: issued.accountId, resumeToken: issued.resumeToken },
  };
}

export function persistPlayerSnapshotRecord(opts: {
  readonly host: PersistenceHost;
  readonly player: PersistablePlayerInput;
  readonly discovery: PersistedPlayerRecord["discovery"];
}): void {
  opts.host.savedProfiles.set(
    opts.player.accountId,
    toPersistedPlayerRecord({ p: opts.player, normalizeName: normalizeOwnerKey, discovery: opts.discovery }),
  );
  opts.host.store.markDirty();
}

export function loadWorldPersistence(opts: {
  readonly store: WorldPersistenceStore;
  readonly worldSeed: number;
  readonly onHydrate: (file: PersistedWorldFile) => void;
}): Map<string, PersistedPlayerRecord> {
  const file = opts.store.load(opts.worldSeed);
  if (!file) return new Map();
  opts.onHydrate(file);
  return indexSavedPlayers(file);
}

export function hydratePlayerProfileIfFound(opts: {
  readonly host: PersistenceHost;
  readonly player: Parameters<typeof applySavedPlayerRecord>[0] & { readonly id: string; readonly accountId: string; readonly name: string; profileHydrated: boolean };
  readonly onHydrateDiscovery?: (playerId: string, discovery: PersistedPlayerRecord["discovery"]) => void;
}): void {
  if (opts.player.profileHydrated) return;
  const saved = opts.host.savedProfiles.get(opts.player.accountId);
  if (!saved) return;
  applySavedPlayerRecord(opts.player, saved);
  opts.onHydrateDiscovery?.(opts.player.id, saved.discovery);
  opts.player.profileHydrated = true;
}

export function buildFullWorldSaveSnapshot(opts: {
  readonly worldSeed: number;
  readonly dayPhase: number;
  readonly dayPaused?: boolean | undefined;
  readonly worldClockSec?: number | undefined;
  readonly sim: WorldSim;
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly activePlayers: Parameters<typeof buildPersistedPlayerList>[0]["activePlayers"];
  readonly beds: readonly SavedBedBinding[];
}): PersistedWorldFile {
  const lit = opts.sim.cache.worldDeltaSnapshot().litBraziers;
  return {
    version: 1,
    worldSeed: opts.worldSeed,
    dayPhase: opts.dayPhase,
    dayPaused: Boolean(opts.dayPaused),
    worldClockSec: opts.worldClockSec ?? 0,
    savedAtMs: Date.now(),
    depleted: opts.sim.combat.harvester.exportDepleted(),
    structures: opts.sim.combat.structures.exportState().structures,
    beds: opts.beds,
    chests: opts.sim.combat.ecology.loot.exportChests(),
    ...(lit?.length ? { litBraziers: lit } : {}),
    players: buildPersistedPlayerList({
      activePlayers: opts.activePlayers, savedProfiles: opts.savedProfiles,
      normalizeName: normalizeOwnerKey, discoveryFor: (id) => opts.sim.discoverySnapshot(id),
    }),
  };
}
