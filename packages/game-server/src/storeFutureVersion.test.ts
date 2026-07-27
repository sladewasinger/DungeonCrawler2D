import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "./store.js";

const tempFile = (): string =>
  join(tmpdir(), `dc2d-store-future-version-test-${Date.now()}-${Math.random()}.json`);

describe("PlayerStore future-version protection", () => {
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
