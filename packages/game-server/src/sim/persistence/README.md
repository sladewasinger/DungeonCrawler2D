# SQLite WAL Persistence (`packages/game-server/src/sim/persistence`)

Durable transactional server persistence powered by Node's built-in `node:sqlite` (`DatabaseSync` in WAL mode):

- `sqliteSchema.ts`: DDL (`world_meta`, `depleted_props`, `structures`, `bed_bindings`, `chests`, `lit_braziers`, `players`, `schema_migrations`) and WAL pragmas.
- `sqliteWorldStore.ts`: `SqliteWorldStore` supporting transactional snapshots, immediate per-player disconnect upserts (`loadPlayerProfile`/`savePlayerProfile`) so offline profiles evict from memory, `WORLD_SAVE_PATH=none` opt-out, and one-time legacy `world-save.json` auto-migration.
