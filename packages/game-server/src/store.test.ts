import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "./store.js";

/**
 * Unit tests for store.ts: xp/level persistence fields (Epic 11 core,
 * ASSUMPTION #90, docs/ASSUMPTIONS.md) — new-record defaults, `addXp`'s
 * mutation + leveledUp flag, backward-compatible load of pre-Epic-11 save
 * files, and survival across a real file-backed restart. Stash/contacts
 * coverage predates this pass and isn't duplicated here.
 */

function tempFile(): string {
  return join(tmpdir(), `dc2d-store-test-${Date.now()}-${Math.random()}.json`);
}

describe("PlayerStore xp/level", () => {
  it("new records start at xp 0, level 1", () => {
    const store = new PlayerStore(null);
    const player = store.get("client-1", "A");
    expect(player.xp).toBe(0);
    expect(player.level).toBe(1);
  });

  it("addXp accumulates xp, recomputes level via the given curve, and flags a level-up once", () => {
    const store = new PlayerStore(null);
    const player = store.get("client-1", "A");
    const curve = (xp: number) => (xp >= 100 ? 2 : 1);

    const first = store.addXp(player, 40, curve);
    expect(first).toEqual({ level: 1, leveledUp: false });
    expect(player.xp).toBe(40);

    const second = store.addXp(player, 70, curve); // 110 total, crosses the 100 threshold
    expect(second).toEqual({ level: 2, leveledUp: true });
    expect(player.xp).toBe(110);

    const third = store.addXp(player, 5, curve); // already level 2, no further level-up
    expect(third).toEqual({ level: 2, leveledUp: false });
  });

  it("loads a pre-Epic-11 save file (no xp/level fields) with defaults", () => {
    const file = tempFile();
    try {
      // Simulates a save written before xp/level existed, same shape contacts.ts already ports.
      const legacy = { nextSlot: 1, players: { "client-1": { slot: 0, name: "A", stash: [], contacts: [] } } };
      writeFileSync(file, JSON.stringify(legacy));
      const store = new PlayerStore(file);
      const player = store.get("client-1", "A");
      expect(player.xp).toBe(0);
      expect(player.level).toBe(1);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("survives a restart: xp/level written by one instance load in a fresh one", () => {
    const file = tempFile();
    try {
      const a = new PlayerStore(file);
      const player = a.get("client-1", "A");
      a.addXp(player, 250, () => 3);
      a.flush();

      const b = new PlayerStore(file);
      const reloaded = b.get("client-1", "A");
      expect(reloaded.xp).toBe(250);
      expect(reloaded.level).toBe(3);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
