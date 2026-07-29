import { describe, expect, it, vi } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { InputController } from "../../../../input/index.js";
import type { Connection } from "../../../../net/connection/connection.js";
import type { FistbumpRing } from "../fistbumpRing.js";
import { syncReviveIndicator } from "./reviveIndicatorSync.js";

vi.mock("../../../../render/entities/geometry/worldToScreen.js", () => ({
  worldToScreen: (x: number, y: number) => ({ x: x * 10, y: y * 10 }),
}));

interface ReviveFixture {
  readonly indicator: FistbumpRing;
  readonly input: InputController;
  readonly connection: Connection;
  readonly update: ReturnType<typeof vi.fn>;
}

function reviveFixture(partyMember: boolean): ReviveFixture {
  const update = vi.fn();
  const target = {
    snap: {
      id: "target",
      kind: "player",
      x: 4,
      y: 7,
      z: 0,
      downed: true,
    },
    samples: [],
  };
  return {
    indicator: { update } as unknown as FistbumpRing,
    input: {
      reviveHoldView: () => ({ targetId: "target", progress: 0.5 }),
    } as unknown as InputController,
    connection: {
      entities: new Map([["target", target]]),
      party: partyMember ? { members: [{ id: "target" }] } : null,
    } as unknown as Connection,
    update,
  };
}

describe("canonical revive indicator", () => {
  it.each([
    ["party", true],
    ["non-party", false],
  ])("uses one large yellow hold indicator for a %s revive", (_label, partyMember) => {
    const fixture = reviveFixture(partyMember);
    syncReviveIndicator(fixture.indicator, fixture.input, fixture.connection);
    expect(fixture.update).toHaveBeenCalledOnce();
    expect(fixture.update).toHaveBeenCalledWith({
      x: 40,
      y: 70 - 1.3 * SCREEN_TILE_PX,
      progress: 0.5,
    });
  });

  it("clears the same indicator when a revive is cancelled or completed", () => {
    const fixture = reviveFixture(true);
    fixture.input.reviveHoldView = vi.fn(() => null);
    syncReviveIndicator(fixture.indicator, fixture.input, fixture.connection);

    const target = fixture.connection.entities.get("target");
    if (target) target.snap = { ...target.snap, downed: false };
    fixture.input.reviveHoldView = vi.fn(
      () => ({ targetId: "target", progress: 1 }),
    );
    syncReviveIndicator(fixture.indicator, fixture.input, fixture.connection);

    expect(fixture.update).toHaveBeenNthCalledWith(1, null);
    expect(fixture.update).toHaveBeenNthCalledWith(2, null);
  });
});
