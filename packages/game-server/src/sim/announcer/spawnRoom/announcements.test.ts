import { LEVEL, World, hashString } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../../store.js";
import { content } from "../../integration/support.js";
import { addPlayer } from "../../players/join.js";
import { createSimState } from "../../state/state.js";
import {
  SPAWN_INTERCOM_ID,
  stepSpawnRoomAnnouncements,
} from "./announcements.js";

describe("spawn room intercom", () => {
  it("rotates announcements and personalizes its crawler callout", () => {
    const sim = createSimState({
      world: new World(hashString("spawn-room-announcer"), 1, LEVEL.Dungeon),
      content,
      store: new PlayerStore(null),
      rngSeed: 4,
      opts: {},
    });
    const joined = addPlayer(sim, { name: "Austin", clientId: "intercom-test" });
    const slot = sim.players.get(joined.playerId)!;
    const speeches: string[] = [];

    for (let tick = 0; tick <= 300; tick++) {
      sim.tickCount = tick;
      stepSpawnRoomAnnouncements(sim);
      for (const event of slot.outbox.splice(0)) {
        if (event.t === "npcSpeech" && event.npcId === SPAWN_INTERCOM_ID) {
          speeches.push(event.text);
        }
      }
    }

    expect(speeches[0]).toBe("GET OUT THERE AND DO SOME DAMAGE!!!");
    expect(speeches[1]).toContain("CRAWLER AUSTIN");
  });
});
