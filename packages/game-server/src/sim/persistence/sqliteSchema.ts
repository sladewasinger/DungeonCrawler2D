/** SQLite WAL schema initialization & forward migrations for persistent overworld/dungeon state. */
import type { DatabaseSync } from "node:sqlite";

const CURRENT_SQLITE_SCHEMA_VERSION = 1;

const SCHEMA_V1_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS world_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  world_seed INTEGER NOT NULL,
  day_phase REAL NOT NULL,
  day_paused INTEGER NOT NULL,
  world_clock_sec REAL NOT NULL,
  floor INTEGER NOT NULL DEFAULT 1,
  collapse_remaining_sec REAL NOT NULL DEFAULT 1440,
  saved_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS depleted_props (
  prop_id TEXT PRIMARY KEY,
  chunk_key TEXT NOT NULL,
  kind INTEGER NOT NULL,
  respawn_at_sec REAL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_depleted_chunk ON depleted_props(chunk_key);

CREATE TABLE IF NOT EXISTS structures (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  zone_id TEXT NOT NULL DEFAULT 'overworld',
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bed_bindings (
  account_id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL DEFAULT 'overworld',
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chests (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL DEFAULT 'overworld',
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lit_braziers (
  brazier_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS players (
  account_id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  floor INTEGER NOT NULL DEFAULT 1,
  json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`;

/** Ensures SQLite WAL pragmas, tables, and schema_migrations row are initialized. */
export function applySqliteMigrations(db: DatabaseSync): void {
  db.exec(SCHEMA_V1_DDL);
  const existing = db.prepare("SELECT version FROM schema_migrations WHERE version = ?").get(CURRENT_SQLITE_SCHEMA_VERSION);
  if (!existing) {
    db.prepare("INSERT INTO schema_migrations (version, applied_at_ms) VALUES (?, ?)").run(
      CURRENT_SQLITE_SCHEMA_VERSION,
      Date.now(),
    );
  }
}
