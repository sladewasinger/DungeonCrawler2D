/** Hydration and persistence export coordinator linking WorldSim, Harvester, Structures, and LootManager. */
import { normalizeOwnerKey, type SavedBedBinding } from "./campStructures.js";
import type { PersistedPlayerRecord, PersistedWorldFile, WorldPersistenceStore } from "./persistenceStore.js";
import { applySavedPlayerRecord, buildPersistedPlayerList, indexSavedPlayers } from "./playerSurvivalState.js";
import type { WorldSim } from "../worldSim.js";

export interface PersistenceHost {
  readonly savedProfiles: Map<string, PersistedPlayerRecord>;
  readonly store: WorldPersistenceStore;
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
  readonly player: Parameters<typeof applySavedPlayerRecord>[0] & { readonly id: string; readonly name: string; profileHydrated: boolean };
  readonly onHydrateDiscovery?: (playerId: string, discovery: PersistedPlayerRecord["discovery"]) => void;
}): void {
  if (opts.player.profileHydrated) return;
  const saved = opts.host.savedProfiles.get(normalizeOwnerKey(opts.player.name));
  if (!saved) return;
  applySavedPlayerRecord(opts.player, saved);
  opts.onHydrateDiscovery?.(opts.player.id, saved.discovery);
  opts.player.profileHydrated = true;
}

export function buildFullWorldSaveSnapshot(opts: {
  readonly worldSeed: number;
  readonly dayPhase: number;
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
