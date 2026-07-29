import {
  CHUNK_SIZE,
  LEVEL,
  World,
  createBody,
  hashString,
  roomKindAt,
  spawnRoomExteriorSite,
  spawnRoomFeatures,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { content } from "../integration/support.js";
import { addPlayer } from "../players/join.js";
import { createSimState } from "../state/state.js";
import { doInteract } from "./interact.js";

describe("spawn room exit", () => {
  it("exits beside the visible facade and keeps its outside door locked", () => {
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
    const landing = spawnRoomExteriorSite().landingPositions[0]!;
    expect(slot.entity.body).toMatchObject(landing);
    expect(slot.returnStack).toEqual([]);
    expect(sim.world.isWalkable(
      Math.floor(slot.entity.body.x),
      Math.floor(slot.entity.body.y),
    )).toBe(true);

    const outside = { ...slot.entity.body };
    doInteract({ sim, slot });

    expect(slot.entity.body).toEqual(outside);
    expect(slot.outbox.at(-1)).toEqual({
      t: "toast",
      msg: "Locked. The only way back in is through the grave.",
    });
  });
});

function roomKindFor(body: { x: number; y: number }) {
  return roomKindAt(
    Math.floor(body.x / CHUNK_SIZE),
    Math.floor(body.y / CHUNK_SIZE),
  );
}
