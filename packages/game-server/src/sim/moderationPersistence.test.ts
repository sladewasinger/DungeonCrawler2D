import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEVEL, World } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import { GameSim } from "./index.js";
import { content, SEED } from "./integration/support.js";

const tempFile = (): string =>
  join(tmpdir(), `dc2d-moderation-${Date.now()}-${Math.random()}.json`);

function sim(store: PlayerStore): GameSim {
  return new GameSim({ world: new World(SEED, 1, LEVEL.Sandbox), content: content, store: store, rngSeed: 1, opts: {} });
}

describe("durable local-profile moderation", () => {
  it("rebinds mute and block controls to new entity ids after restart", () => {
    const file = tempFile();
    try {
      const firstStore = new PlayerStore(file);
      const first = sim(firstStore);
      const a = first.addPlayer({ name: "A", clientId: "client-a" });
      const b = first.addPlayer({ name: "B", clientId: "client-b" });
      first.queueAction(b.playerId, { type: "moderation", op: "mute", target: a.playerId });
      first.step();
      firstStore.flush();

      const secondStore = new PlayerStore(file);
      const second = sim(secondStore);
      const restoredB = second.addPlayer({ name: "B", clientId: "client-b" });
      const restoredA = second.addPlayer({ name: "A", clientId: "client-a" });
      expect(restoredA.playerId).not.toBe(a.playerId);
      second.queueAction(restoredA.playerId, {
        type: "chat",
        channel: "global",
        text: "still muted",
      });
      const snapshot = second.step().get(restoredB.playerId);
      expect(snapshot?.events).toContainEqual({
        t: "moderationUpdated",
        muted: [restoredA.playerId],
        blocked: [],
      });
      expect(snapshot?.events.some(
        (event) => event.t === "chat" && event.text === "still muted",
      )).toBe(false);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
