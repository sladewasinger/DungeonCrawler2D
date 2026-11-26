/** Node sqlite WAL-backed world & player persistence with one-time legacy JSON migration. */
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { PersistedPlayerRecord, PersistedWorldFile } from "../survival/persistenceStore.js";
import { sanitizeLoadedWorld } from "../survival/persistenceStore.js";
import { applySqliteMigrations } from "./sqliteSchema.js";

function resolvePaths(rawPath?: string | undefined): { readonly dbPath: string; readonly legacyJsonPath: string } | null {
  if (!rawPath || rawPath === "none") return null;
  if (/\.json$/i.test(rawPath)) {
    return { dbPath: rawPath.replace(/\.json$/i, ".db"), legacyJsonPath: rawPath };
  }
  return { dbPath: rawPath, legacyJsonPath: join(dirname(rawPath), "world-save.json") };
}

function parseRows<T>(rows: readonly Record<string, unknown>[]): T[] {
  const out: T[] = [];
  for (const r of rows) {
    if (typeof r.json === "string") out.push(JSON.parse(r.json) as T);
  }
  return out;
}

function runTx(db: DatabaseSync, fn: () => void): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    fn();
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* noop */ }
    throw err;
  }
}

export class SqliteWorldStore {
  private readonly paths: { readonly dbPath: string; readonly legacyJsonPath: string } | null;
  private db: DatabaseSync | null = null;
  private dirty = false;
  private lastFlushMs = 0;

  constructor(rawPath?: string | undefined) {
    this.paths = resolvePaths(rawPath);
  }

  isEnabled(): boolean {
    return Boolean(this.paths);
  }

  private ensureDb(): DatabaseSync | null {
    if (!this.paths) return null;
    if (!this.db) {
      mkdirSync(dirname(this.paths.dbPath), { recursive: true });
      this.db = new DatabaseSync(this.paths.dbPath);
      applySqliteMigrations(this.db);
    }
    return this.db;
  }

  markDirty(): void {
    this.dirty = true;
  }

  private maybeImportLegacyJson(db: DatabaseSync, expectedSeed: number): PersistedWorldFile | null {
    if (!this.paths || !existsSync(this.paths.legacyJsonPath)) return null;
    try {
      const parsed = JSON.parse(readFileSync(this.paths.legacyJsonPath, "utf8")) as Partial<PersistedWorldFile>;
      const clean = sanitizeLoadedWorld(parsed, expectedSeed);
      if (!clean) return null;
      this.writeSnapshotTx(db, clean);
      try { renameSync(this.paths.legacyJsonPath, `${this.paths.legacyJsonPath}.migrated`); } catch { /* ignore */ }
      return clean;
    } catch {
      return null;
    }
  }

  load(expectedSeed: number): PersistedWorldFile | null {
    const db = this.ensureDb();
    if (!db) return null;
    const meta = db.prepare("SELECT world_seed, day_phase, day_paused, world_clock_sec, saved_at_ms FROM world_meta WHERE id = 1").get() as
      | { world_seed: number; day_phase: number; day_paused: number; world_clock_sec: number; saved_at_ms: number }
      | undefined;
    if (!meta) return this.maybeImportLegacyJson(db, expectedSeed);
    if (meta.world_seed !== expectedSeed) return null;
    const brazierRows = db.prepare("SELECT brazier_id FROM lit_braziers").all() as { brazier_id: string }[];
    return {
      version: 1,
      worldSeed: meta.world_seed,
      dayPhase: meta.day_phase,
      dayPaused: Boolean(meta.day_paused),
      worldClockSec: meta.world_clock_sec,
      savedAtMs: meta.saved_at_ms,
      depleted: parseRows(db.prepare("SELECT json FROM depleted_props").all() as Record<string, unknown>[]),
      structures: parseRows(db.prepare("SELECT json FROM structures").all() as Record<string, unknown>[]),
      beds: parseRows(db.prepare("SELECT json FROM bed_bindings").all() as Record<string, unknown>[]),
      chests: parseRows(db.prepare("SELECT json FROM chests").all() as Record<string, unknown>[]),
      players: parseRows(db.prepare("SELECT json FROM players").all() as Record<string, unknown>[]),
      litBraziers: brazierRows.map((b) => b.brazier_id),
    };
  }

  loadPlayerProfile(accountId: string): PersistedPlayerRecord | null {
    const db = this.ensureDb();
    if (!db) return null;
    const row = db.prepare("SELECT json FROM players WHERE account_id = ?").get(accountId) as { json?: string } | undefined;
    return row?.json ? (JSON.parse(row.json) as PersistedPlayerRecord) : null;
  }

  savePlayerProfile(rec: PersistedPlayerRecord): void {
    const db = this.ensureDb();
    if (!db) return;
    const acct = rec.accountId ?? rec.ownerKey;
    db.prepare(
      "INSERT INTO players (account_id, owner_key, json, updated_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET owner_key=excluded.owner_key, json=excluded.json, updated_at_ms=excluded.updated_at_ms",
    ).run(acct, rec.ownerKey, JSON.stringify(rec), Date.now());
  }

  private writeSnapshotTx(db: DatabaseSync, snap: PersistedWorldFile): void {
    runTx(db, () => {
      db.prepare(
        "INSERT INTO world_meta (id, world_seed, day_phase, day_paused, world_clock_sec, saved_at_ms) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET world_seed=excluded.world_seed, day_phase=excluded.day_phase, day_paused=excluded.day_paused, world_clock_sec=excluded.world_clock_sec, saved_at_ms=excluded.saved_at_ms",
      ).run(snap.worldSeed, snap.dayPhase, snap.dayPaused ? 1 : 0, snap.worldClockSec ?? 0, snap.savedAtMs);
      this.syncDepleted(db, snap.depleted);
      this.syncStructures(db, snap.structures);
      this.syncBeds(db, snap.beds);
      this.syncChests(db, snap.chests);
      this.syncBraziers(db, snap.litBraziers ?? []);
      this.upsertPlayers(db, snap.players);
    });
  }

  private syncDepleted(db: DatabaseSync, items: PersistedWorldFile["depleted"]): void {
    db.exec("DELETE FROM depleted_props");
    const ins = db.prepare("INSERT INTO depleted_props (prop_id, chunk_key, kind, respawn_at_sec, json) VALUES (?, ?, ?, ?, ?)");
    for (const d of items) ins.run(d.propId, `${d.cx ?? 0},${d.cy ?? 0}`, d.replacementKind ?? 0, d.regrowAtSec ?? null, JSON.stringify(d));
  }

  private syncStructures(db: DatabaseSync, items: PersistedWorldFile["structures"]): void {
    db.exec("DELETE FROM structures");
    const ins = db.prepare("INSERT INTO structures (id, owner_key, kind, json) VALUES (?, ?, ?, ?)");
    for (const s of items) ins.run(s.id, s.ownerName ?? "", s.kind, JSON.stringify(s));
  }

  private syncBeds(db: DatabaseSync, items: PersistedWorldFile["beds"]): void {
    db.exec("DELETE FROM bed_bindings");
    const ins = db.prepare("INSERT INTO bed_bindings (account_id, json) VALUES (?, ?)");
    for (const b of items) ins.run(b.ownerKey, JSON.stringify(b));
  }

  private syncChests(db: DatabaseSync, items: PersistedWorldFile["chests"]): void {
    db.exec("DELETE FROM chests");
    const ins = db.prepare("INSERT INTO chests (id, json) VALUES (?, ?)");
    for (const c of items) ins.run(c.id, JSON.stringify(c));
  }

  private syncBraziers(db: DatabaseSync, ids: readonly string[]): void {
    db.exec("DELETE FROM lit_braziers");
    const ins = db.prepare("INSERT INTO lit_braziers (brazier_id) VALUES (?)");
    for (const id of ids) ins.run(id);
  }

  private upsertPlayers(db: DatabaseSync, players: PersistedWorldFile["players"]): void {
    const ins = db.prepare(
      "INSERT INTO players (account_id, owner_key, json, updated_at_ms) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET owner_key=excluded.owner_key, json=excluded.json, updated_at_ms=excluded.updated_at_ms",
    );
    const now = Date.now();
    for (const p of players) ins.run(p.accountId ?? p.ownerKey, p.ownerKey, JSON.stringify(p), now);
  }

  saveNow(snapshot: PersistedWorldFile): void {
    const db = this.ensureDb();
    if (!db) return;
    this.writeSnapshotTx(db, snapshot);
    this.dirty = false;
    this.lastFlushMs = Date.now();
  }

  maybeFlush(nowMs: number, buildSnapshot: () => PersistedWorldFile): void {
    if (!this.paths || !this.dirty || nowMs - this.lastFlushMs < 10_000) return;
    this.saveNow(buildSnapshot());
  }

  close(): void {
    if (!this.db) return;
    try { this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); } catch { /* noop */ }
    this.db.close();
    this.db = null;
  }
}
