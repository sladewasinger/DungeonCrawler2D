import { describe, expect, it } from "vitest";
import type { AdminMap } from "@dc2d/engine";
import { mapForAdminSurface } from "./adminPageLifecycle.js";

describe("admin surface map selection", () => {
  it("uses the authoritative spectator map with the selected player and nearby actors", () => {
    const inspector = map([{ id: "other", kind: "enemy" }]);
    const spectator = map([
      { id: "target", kind: "player" }, { id: "mob", kind: "enemy" }, { id: "pet", kind: "pet" },
    ]);

    const selected = mapForAdminSurface({
      adminMap: inspector,
      adminSpectatorMap: spectator,
      spectatorMode: "track",
    });

    expect(selected).toBe(spectator);
    expect(selected?.entities.map(({ id }) => id)).toEqual(["target", "mob", "pet"]);
  });

  it("keeps the spawner inspector map when spectating is off", () => {
    const inspector = map([]);
    expect(mapForAdminSurface({ adminMap: inspector, adminSpectatorMap: map([]), spectatorMode: "off" }))
      .toBe(inspector);
  });
});

function map(entities: Array<{ id: string; kind: AdminMap["entities"][number]["kind"] }>): AdminMap {
  return {
    level: "dungeon", floor: 1, center: { x: 0.5, y: 0.5 }, radius: 10,
    cells: [], entities: entities.map((entity) => ({ ...entity, x: 0.5, y: 0.5, z: 0 })),
  } as AdminMap;
}
