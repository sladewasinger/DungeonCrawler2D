import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_APPEARANCE } from "@dc2d/engine";
import { createStarterInventory } from "../playerInventory.js";
import type { PersistedWorldFile } from "../survival/persistenceStore.js";
import { WorldSim } from "../worldSim.js";
import { SqliteWorldStore } from "./sqliteWorldStore.js";

const DB_FILENAME = "world-save.db";

const dirs: string[] = [];
function makeTmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), "dc2d-sqlite-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("SqliteWorldStore", () => {
  it("persists world state in WAL SQLite across restarts and migrates legacy JSON once", () => {
    const dir = makeTmpDir();
    const jsonPath = join(dir, "world-save.json");
    const legacy: PersistedWorldFile = {
      version: 1,
      worldSeed: 1337,
      dayPhase: 0.42,
      dayPaused: true,
      worldClockSec: 120,
      savedAtMs: 1000,
      depleted: [],
      structures: [{ id: "st-1", kind: "campfire", itemId: "camp-campfire", x: 3, y: 4, elevation: 0, ownerName: "Scout" }],
      beds: [],
      chests: [],
      players: [{
        ownerKey: "scout",
        accountId: "acc_scout",
        x: 6,
        y: 8,
        elevation: 0,
        appearance: DEFAULT_APPEARANCE,
        inventory: createStarterInventory(),
      }],
    };
    writeFileSync(jsonPath, JSON.stringify(legacy), "utf8");

    const store = new SqliteWorldStore(jsonPath);
    const loaded = store.load(1337);
    expect(loaded?.structures).toHaveLength(1);
    expect(loaded?.players[0]?.x).toBe(6);
    expect(existsSync(join(dir, DB_FILENAME))).toBe(true);
    expect(existsSync(`${jsonPath}.migrated`)).toBe(true);
    store.close();

    const store2 = new SqliteWorldStore(join(dir, DB_FILENAME));
    expect(store2.load(1337)?.dayPhase).toBeCloseTo(0.42, 4);
    expect(store2.loadPlayerProfile("acc_scout")?.y).toBe(8);
    store2.close();
  });

  it("evicts offline players from WorldSim heap while retaining reload state in SQLite", () => {
    const dir = makeTmpDir();
    const dbPath = join(dir, DB_FILENAME);
    const sim = new WorldSim(1337, { persistencePath: dbPath });
    const auth = sim.authenticateSession();
    const pid = sim.addPlayer("Rover", undefined, { accountId: auth.accountId, tokenHash: auth.tokenHash });
    const p = sim.getPlayer(pid)!;
    p.x = 12.5; p.y = -4.25;
    sim.removePlayer(pid);
    expect(sim.offlineProfileCount()).toBe(0);

    const authAgain = sim.authenticateSession({ accountId: auth.accountId, resumeToken: auth.issuedCredentials!.resumeToken });
    expect(authAgain.issuedCredentials).toBeUndefined();
    const pid2 = sim.addPlayer("Rover", undefined, { accountId: auth.accountId, tokenHash: auth.tokenHash });
    expect(sim.getPlayer(pid2)?.x).toBeCloseTo(12.5, 3);
    sim.closePersistence();
  });
});
