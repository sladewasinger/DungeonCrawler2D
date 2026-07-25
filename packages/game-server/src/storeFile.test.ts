import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PlayerStore } from "./store.js";
import { PLAYER_STORE_VERSION } from "./storeFile.js";

const tempFile = (): string =>
  join(tmpdir(), `dc2d-store-file-test-${Date.now()}-${Math.random()}.json`);

describe("PlayerStore file integrity", () => {
  it("writes the current explicit store version through an atomic replacement", () => {
    const file = tempFile();
    try {
      const store = new PlayerStore(file);
      store.get("client-1", "A");
      store.flush();
      const saved = JSON.parse(readFileSync(file, "utf8")) as { version: number };
      expect(saved.version).toBe(PLAYER_STORE_VERSION);
      expect(existsSync(`${file}.${process.pid}.tmp`)).toBe(false);
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("migrates a valid unversioned save immediately without losing data", () => {
    const file = tempFile();
    try {
      const legacy = {
        nextSlot: 1,
        players: {
          "client-1": {
            slot: 0,
            name: "A",
            stash: [{ item: "torch", qty: 2 }],
            contacts: ["B"],
          },
        },
      };
      writeFileSync(file, JSON.stringify(legacy));
      const store = new PlayerStore(file);
      expect(store.get("client-1", "A").stash).toEqual([{ item: "torch", qty: 2 }]);
      const migrated = JSON.parse(readFileSync(file, "utf8")) as {
        version: number;
        players: typeof legacy.players;
      };
      expect(migrated.version).toBe(PLAYER_STORE_VERSION);
      expect(migrated.players["client-1"]?.contacts).toEqual(["B"]);
      expect(migrated.players["client-1"]).toMatchObject({
        activeFloor: 1,
        descentComplete: false,
      });
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("migrates version 1 saves to version 2 descent state defaults", () => {
    const file = tempFile();
    try {
      writeFileSync(file, JSON.stringify({
        version: 1,
        nextSlot: 1,
        players: {
          "client-1": {
            slot: 0,
            name: "A",
            stash: [],
            contacts: [],
            xp: 40,
            level: 2,
            deepestFloor: 4,
          },
        },
      }));
      const store = new PlayerStore(file);
      expect(store.get("client-1", "A")).toMatchObject({
        deepestFloor: 4,
        activeFloor: 1,
        descentComplete: false,
      });
      expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
        version: 2,
        players: {
          "client-1": {
            activeFloor: 1,
            descentComplete: false,
          },
        },
      });
    } finally {
      rmSync(file, { force: true });
    }
  });

  it("quarantines malformed JSON instead of silently overwriting it", () => {
    const file = tempFile();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      writeFileSync(file, "{broken");
      const store = new PlayerStore(file);
      expect(store.has("client-1")).toBe(false);
      expect(existsSync(file)).toBe(false);
      const quarantined = readdirSync(dirname(file)).find((entry) =>
        entry.startsWith(`${basename(file)}.corrupt-`));
      expect(quarantined).toBeTruthy();
      expect(readFileSync(join(dirname(file), quarantined!), "utf8")).toBe("{broken");
      rmSync(join(dirname(file), quarantined!), { force: true });
    } finally {
      error.mockRestore();
      rmSync(file, { force: true });
    }
  });

  it("preserves an unsupported future-version file and refuses to open it", () => {
    const file = tempFile();
    const future = JSON.stringify({ version: 99, nextSlot: 0, players: {} });
    try {
      writeFileSync(file, future);
      expect(() => new PlayerStore(file)).toThrow("Unsupported player store version 99");
      expect(readFileSync(file, "utf8")).toBe(future);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
