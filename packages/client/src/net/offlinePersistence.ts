/** Seed-keyed localStorage offline world snapshot persistence and 5s throttled flush helper. */
import {
  DepletedPropSchema, InventorySnapshotSchema, PlacedStructureSchema, WorldChestSnapshotSchema,
} from "@dc2d/engine";
import { z } from "zod";

const OFFLINE_WORLD_STORAGE_PREFIX = "dc2d_offline_world_v1_";
const FLUSH_INTERVAL_MS = 5_000;

const OfflineBedRecordSchema = z.object({
  ownerKey: z.string(),
  structureId: z.string(),
  x: z.number(),
  y: z.number(),
  elevation: z.number().int(),
});

const OfflinePlayerStateSchema = z.object({
  x: z.number(),
  y: z.number(),
  elevation: z.number().int(),
  inventory: InventorySnapshotSchema,
  wellFedTimer: z.number().min(0),
  invigoratedTimer: z.number().min(0),
  restedTimer: z.number().min(0),
  hotTimer: z.number().min(0),
});

export const OfflineWorldSnapshotSchema = z.object({
  version: z.literal(1),
  worldSeed: z.number().int(),
  dayPhase: z.number(),
  depleted: z.array(DepletedPropSchema),
  structures: z.array(PlacedStructureSchema),
  beds: z.array(OfflineBedRecordSchema),
  chests: z.array(WorldChestSnapshotSchema),
  player: OfflinePlayerStateSchema,
});

export type OfflineWorldSnapshot = z.infer<typeof OfflineWorldSnapshotSchema>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function offlineWorldStorageKey(worldSeed: number): string {
  return `${OFFLINE_WORLD_STORAGE_PREFIX}${worldSeed}`;
}

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function loadOfflineWorldState(worldSeed: number, storage: StorageLike | null = defaultStorage()): OfflineWorldSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(offlineWorldStorageKey(worldSeed));
    if (!raw) return null;
    const parsed = OfflineWorldSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.worldSeed !== worldSeed) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveOfflineWorldState(snap: OfflineWorldSnapshot, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    const validated = OfflineWorldSnapshotSchema.parse(snap);
    storage.setItem(offlineWorldStorageKey(validated.worldSeed), JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}

export function clearOfflineWorldState(worldSeed: number, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try { storage.removeItem(offlineWorldStorageKey(worldSeed)); } catch { /* ignore private storage errors */ }
}

export class OfflineWorldSaver {
  private dirty = false;
  private lastFlushMs = 0;

  constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

  markDirty(): void { this.dirty = true; }
  isDirty(): boolean { return this.dirty; }

  flushNow(build: () => OfflineWorldSnapshot, nowMs = Date.now()): boolean {
    const ok = saveOfflineWorldState(build(), this.storage);
    if (ok) { this.dirty = false; this.lastFlushMs = nowMs; }
    return ok;
  }

  maybeFlush(nowMs: number, build: () => OfflineWorldSnapshot): boolean {
    if (!this.dirty || nowMs - this.lastFlushMs < FLUSH_INTERVAL_MS) return false;
    return this.flushNow(build, nowMs);
  }
}
