/** Atomic debounced JSON world persistence for depleted nodes, placed camp structures, chests, and players. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CharacterAppearance, DepletedPropDelta, PlacedStructureRecord, PlayerInventoryState } from "@dc2d/engine";
import type { SavedBedBinding } from "./campStructures.js";
import type { SavedChestRecord } from "../wildlife/lootManager.js";

export interface PersistedPlayerRecord {
  readonly ownerKey: string;
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly appearance: CharacterAppearance;
  readonly inventory: PlayerInventoryState;
  readonly wellFedTimer?: number | undefined;
  readonly restedTimer?: number | undefined;
}

export interface PersistedWorldFile {
  readonly version: 1;
  readonly worldSeed: number;
  readonly dayPhase: number;
  readonly savedAtMs: number;
  readonly depleted: readonly DepletedPropDelta[];
  readonly structures: readonly PlacedStructureRecord[];
  readonly beds: readonly SavedBedBinding[];
  readonly chests: readonly SavedChestRecord[];
  readonly players: readonly PersistedPlayerRecord[];
}

const arr = <T>(v: unknown): readonly T[] => (Array.isArray(v) ? (v as T[]) : []);

function sanitizeLoadedWorld(data: Partial<PersistedWorldFile>, expectedSeed: number): PersistedWorldFile | null {
  if (data.version !== 1 || data.worldSeed !== expectedSeed) return null;
  return {
    version: 1,
    worldSeed: expectedSeed,
    dayPhase: typeof data.dayPhase === "number" ? data.dayPhase : 0.62,
    savedAtMs: typeof data.savedAtMs === "number" ? data.savedAtMs : 0,
    depleted: arr(data.depleted),
    structures: arr(data.structures),
    beds: arr(data.beds),
    chests: arr(data.chests),
    players: arr(data.players),
  };
}

export class WorldPersistenceStore {
  private dirty = false;
  private lastFlushMs = 0;

  constructor(private readonly filePath?: string | undefined) {}

  isEnabled(): boolean {
    return Boolean(this.filePath);
  }

  markDirty(): void {
    this.dirty = true;
  }

  load(expectedSeed: number): PersistedWorldFile | null {
    if (!this.filePath || !existsSync(this.filePath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<PersistedWorldFile>;
      return sanitizeLoadedWorld(parsed, expectedSeed);
    } catch {
      return null;
    }
  }

  saveNow(snapshot: PersistedWorldFile): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(snapshot), "utf8");
    renameSync(tmpPath, this.filePath);
    this.dirty = false;
    this.lastFlushMs = Date.now();
  }

  maybeFlush(nowMs: number, buildSnapshot: () => PersistedWorldFile): void {
    if (!this.filePath || !this.dirty || nowMs - this.lastFlushMs < 10_000) return;
    this.saveNow(buildSnapshot());
  }
}
