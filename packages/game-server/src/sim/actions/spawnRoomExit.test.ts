import {
  CHUNK_SIZE,
  LEVEL,
  World,
  createBody,
  hashString,
  roomKindAt,
  spawnRoomFeatures,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { content } from "../integration/support.js";
import { addPlayer } from "../players/join.js";
import { createSimState } from "../state/state.js";
import { doInteract } from "./interact.js";

describe("spawn room exit", () => {
  it("starts every new crawler inside and exits one-way near world origin", () => {
    const sim = createSimState({
      world: new World(hashString("spawn-room-exit"), 1, LEVEL.Dungeon),
      content,
      store: new PlayerStore(null),
      rngSeed: 7,
      opts: {},
    });
    const joined = addPlayer(sim, { name: "Tester", clientId: "spawn-room-test" });
    const slot = sim.players.get(joined.playerId)!;
    expect(roomKindFor(slot.entity.body)).toBe("spawn");

    const exit = spawnRoomFeatures().exit;
    slot.entity.body = createBody(
      exit.x + 0.5,
      exit.y - 0.5,
      sim.world.groundAt(exit.x + 0.5, exit.y - 0.5),
    );
    doInteract({ sim, slot });

    expect(roomKindFor(slot.entity.body)).toBeNull();
    expect(Math.hypot(slot.entity.body.x, slot.entity.body.y))
      .toBeLessThan(50);
    expect(slot.returnStack).toEqual([]);
    expect(sim.world.isWalkable(
      Math.floor(slot.entity.body.x),
      Math.floor(slot.entity.body.y),
    )).toBe(true);
  });
});

function roomKindFor(body: { x: number; y: number }) {
  return roomKindAt(
    Math.floor(body.x / CHUNK_SIZE),
    Math.floor(body.y / CHUNK_SIZE),
  );
}
