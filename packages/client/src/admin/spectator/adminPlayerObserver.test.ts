import { describe, expect, it } from "vitest";
import type { AdminMap } from "@dc2d/engine";
import type { AdminPlayerObserverRenderInput } from "./adminPlayerObserver.js";
import { adminLiveViewerProjection } from "./adminLiveViewerProjection.js";
import { liveSpectatorActorPlan } from "./actors/liveSpectatorActorPlan.js";
import { createLiveSpectatorView } from "./liveSpectatorView.js";

describe("admin live spectator projection", () => {
  it("passes authoritative spectator map entities to the live renderer in track mode", () => {
    const map = spectatorMap();
    const projection = adminLiveViewerProjection(input(map, "track", "target"), 1.2);

    expect(projection.active).toBe(true);
    expect(projection.targetId).toBe("target");
    expect(projection.map).toBe(map);
    expect(projection.map?.entities.map(({ id }) => id)).toEqual(["target", "enemy", "pet"]);
  });

  it("does not follow a target while free camera is active", () => {
    const projection = adminLiveViewerProjection(input(spectatorMap(), "free", "target"), 1);

    expect(projection.active).toBe(true);
    expect(projection.targetId).toBeNull();
  });

  it("falls back to the selected player while tracking has no explicit id", () => {
    const selected = { playerId: "target", name: "Austin" } as AdminPlayerObserverRenderInput["player"];
    const projection = adminLiveViewerProjection({
      ...input(spectatorMap(), "track", null),
      player: selected,
    }, 1);

    expect(projection.targetId).toBe("target");
  });

  it("plans every authoritative actor and marks only the tracked target", () => {
    const map = spectatorMap();
    const view = createLiveSpectatorView({
      map,
      targetId: "target",
      canvas: { width: 800, height: 450 },
    });

    const plan = liveSpectatorActorPlan({ map, targetId: "target", view });
    expect(plan.map(({ entity }) => entity.id)).toEqual(expect.arrayContaining(["target", "enemy", "pet"]));
    expect(plan).toHaveLength(3);
    expect(plan.find(({ entity }) => entity.id === "target")?.target).toBe(true);
    expect(plan.filter(({ target }) => target).map(({ entity }) => entity.id)).toEqual(["target"]);
  });
});

function input(
  spectatorMap: AdminMap,
  spectatorMode: AdminPlayerObserverRenderInput["spectatorMode"],
  spectatorTargetId: string | null,
): AdminPlayerObserverRenderInput {
  return {
    player: null, spectatorPlayer: null, authenticated: true,
    spectatorMode, spectatorTargetId, spectatorMap,
  };
}

function spectatorMap(): AdminMap {
  return {
    level: "dungeon", floor: 1, center: { x: 8.5, y: 9.5 }, radius: 10, cells: [],
    entities: [
      { id: "target", kind: "player", x: 8.5, y: 9.5, z: 0 },
      { id: "enemy", kind: "enemy", x: 10.5, y: 9.5, z: 0 },
      { id: "pet", kind: "pet", x: 7.5, y: 9.5, z: 0 },
    ],
  };
}
