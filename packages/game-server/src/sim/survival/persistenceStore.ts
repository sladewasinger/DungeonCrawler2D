/** Atomic debounced JSON world persistence for depleted nodes, placed camp structures, chests, and players. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CharacterAppearance, DepletedPropDelta, DiscoveryStateSnapshot, PlacedStructureRecord, PlayerInventoryState } from "@dc2d/engine";
import type { SavedBedBinding } from "./campStructures.js";
import type { SavedChestRecord } from "../wildlife/lootManager.js";

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

function sanitizeLoadedWorld(data: Partial<PersistedWorldFile>, expectedSeed: number): PersistedWorldFile | null {
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

export class WorldPersistenceStore {
  private dirty = false;
  private dirtyRev = 0;
  private flushInFlight = false;
  private lastFlushMs = 0;

  constructor(private readonly filePath?: string | undefined) {}

  isEnabled(): boolean {
    return Boolean(this.filePath);
  }

  markDirty(): void {
    this.dirty = true;
    this.dirtyRev += 1;
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
    if (!this.filePath || !this.dirty || this.flushInFlight || nowMs - this.lastFlushMs < 10_000) return;
    const targetPath = this.filePath;
    const revAtStart = this.dirtyRev;
    const payload = JSON.stringify(buildSnapshot());
    this.flushInFlight = true;
    this.lastFlushMs = nowMs;
    void this.writeAsync(targetPath, payload, revAtStart);
  }

  private async writeAsync(targetPath: string, payload: string, revAtStart: number): Promise<void> {
    try {
      await mkdir(dirname(targetPath), { recursive: true });
      const tmpPath = `${targetPath}.tmp`;
      await writeFile(tmpPath, payload, "utf8");
      await rename(tmpPath, targetPath);
      if (this.dirtyRev === revAtStart) this.dirty = false;
    } catch {
      // Leave dirty flag intact so next interval retries async persistence.
    } finally {
      this.flushInFlight = false;
    }
  }
}
