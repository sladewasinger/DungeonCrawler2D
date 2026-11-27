/** Persisted snapshot schema definitions and sanitizers. */
import type { CharacterAppearance, DepletedPropDelta, DiscoveryStateSnapshot, PlacedStructureRecord, PlayerInventoryState } from "@dc2d/engine";
import type { SavedBedBinding } from "./campStructures.js";
import type { SavedChestRecord } from "../wildlife/loot/lootManager.js";

export interface PersistedPlayerRecord {
  readonly ownerKey: string;
  readonly accountId?: string | undefined;
  readonly tokenHash?: string | undefined;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly appearance: CharacterAppearance;
  readonly inventory: PlayerInventoryState;
  readonly wellFedTimer?: number | undefined;
  readonly restedTimer?: number | undefined;
  readonly discovery?: DiscoveryStateSnapshot | undefined;
}

export interface PersistedWorldFile {
  readonly version: 1;
  readonly worldSeed: number;
  readonly dayPhase: number;
  readonly dayPaused?: boolean | undefined;
  readonly worldClockSec?: number | undefined;
  readonly savedAtMs: number;
  readonly depleted: readonly DepletedPropDelta[];
  readonly structures: readonly PlacedStructureRecord[];
  readonly beds: readonly SavedBedBinding[];
  readonly chests: readonly SavedChestRecord[];
  readonly players: readonly PersistedPlayerRecord[];
  readonly litBraziers?: readonly string[] | undefined;
}

const arr = <T>(v: unknown): readonly T[] => (Array.isArray(v) ? (v as T[]) : []);

export function sanitizeLoadedWorld(data: Partial<PersistedWorldFile>, expectedSeed: number): PersistedWorldFile | null {
  if (data.version !== 1 || data.worldSeed !== expectedSeed) return null;
  const worldClockSec = typeof data.worldClockSec === "number" && Number.isFinite(data.worldClockSec) ? Math.max(0, data.worldClockSec) : 0;
  return {
    version: 1,
    worldSeed: expectedSeed,
    dayPhase: typeof data.dayPhase === "number" ? data.dayPhase : 0.62,
    dayPaused: Boolean(data.dayPaused),
    worldClockSec,
    savedAtMs: typeof data.savedAtMs === "number" ? data.savedAtMs : 0,
    depleted: arr(data.depleted),
    structures: arr(data.structures),
    beds: arr(data.beds),
    chests: arr(data.chests),
    players: arr(data.players),
    litBraziers: arr(data.litBraziers),
  };
}
