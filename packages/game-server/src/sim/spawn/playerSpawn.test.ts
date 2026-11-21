import {
  CHUNK_SIZE,
  buildContentRegistry,
  createBody,
  roomKindAt,
  spawnRoomFeatures,
  type RawContent,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../../store.js";
import { addPlayer } from "../players/join.js";
import { createSimState } from "../state/state.js";
import { doInteract } from "../actions/interact.js";
import { finiteServerWorldFixture } from "../testing/finiteWorldTestSupport.js";

const EMPTY_CONTENT: RawContent = {
  statuses: [], rules: [], areas: [], items: [], enemies: [], recipes: [],
};

describe("finite dungeon join spawn", () => {
  it("starts in the authored room and exits into the generated floor envelope", () => {
    const world = finiteServerWorldFixture();
    const sim = createSimState({
      world,
      content: buildContentRegistry(EMPTY_CONTENT),
      store: new PlayerStore(null),
      rngSeed: 1,
      opts: {},
    });
    const join = addPlayer(sim, { name: "Crawler", clientId: "finite-join" });
    const floor = world.generatedFloor;
    const slot = sim.players.get(join.playerId)!;
    const exit = spawnRoomFeatures().exit;

    expect(floor).not.toBeNull();
    expect(join.spawn).toEqual({ x: slot.entity.body.x, y: slot.entity.body.y, z: slot.entity.body.z });
    expect(roomKindAt(Math.floor(join.spawn.x / CHUNK_SIZE), Math.floor(join.spawn.y / CHUNK_SIZE))).toBe("spawn");
    slot.entity.body = createBody(exit.x + 0.5, exit.y - 0.5, world.groundAt(exit.x + 0.5, exit.y - 0.5));
    doInteract({ sim, slot });

    expect(Math.floor(slot.entity.body.x)).toBeGreaterThanOrEqual(floor!.bounds.minX);
    expect(Math.floor(slot.entity.body.x)).toBeLessThanOrEqual(floor!.bounds.maxX);
    expect(Math.floor(slot.entity.body.y)).toBeGreaterThanOrEqual(floor!.bounds.minY);
    expect(Math.floor(slot.entity.body.y)).toBeLessThanOrEqual(floor!.bounds.maxY);
    expect(world.isWalkable(Math.floor(slot.entity.body.x), Math.floor(slot.entity.body.y))).toBe(true);
  });
});
