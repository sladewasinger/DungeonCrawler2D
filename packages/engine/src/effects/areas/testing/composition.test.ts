import { describe, expect, it } from "vitest";
import { AreaSystem } from "../system.js";
import {
  buildAreaTestContent,
  FIRE_AREA_ID,
  flatAreaWorld,
  OIL_AREA_ID,
  SMOKE_AREA_ID,
  STEAM_AREA_ID,
  VODKA_AREA_ID,
  WET_AREA_ID,
} from "./areaTestSupport.js";

const X = 7;
const Y = 9;

describe("compound area composition", () => {
  it("resolves fire and wet identically in either placement order", () => {
    const wetFirst = placePair(WET_AREA_ID, FIRE_AREA_ID);
    const fireFirst = placePair(FIRE_AREA_ID, WET_AREA_ID);
    expect(wetFirst.allTiles()).toEqual(fireFirst.allTiles());
    expect(wetFirst.defsAt(X, Y)).toEqual([STEAM_AREA_ID]);
  });

  it("uses priority and preserves existing layers on equal priority", () => {
    const higherWins = new AreaSystem(buildAreaTestContent(), flatAreaWorld());
    higherWins.place(areaPlacement(OIL_AREA_ID));
    expect(higherWins.place(areaPlacement(WET_AREA_ID)).applied).toBe(true);
    expect(higherWins.defsAt(X, Y)).toEqual([WET_AREA_ID]);

    const lowerLoses = new AreaSystem(buildAreaTestContent(), flatAreaWorld());
    lowerLoses.place(areaPlacement(WET_AREA_ID));
    expect(lowerLoses.place(areaPlacement(OIL_AREA_ID))).toMatchObject({
      applied: false,
      reason: "lower-priority-channel",
    });

    expect(lowerLoses.place(areaPlacement(VODKA_AREA_ID))).toMatchObject({
      applied: false,
      reason: "equal-priority-channel",
    });
    expect(lowerLoses.defsAt(X, Y)).toEqual([WET_AREA_ID]);
  });

  it("sorts matching reactions independently of declaration order", () => {
    const alpha = replacementReaction("alpha-steam", STEAM_AREA_ID);
    const zeta = replacementReaction("zeta-smoke", SMOKE_AREA_ID);
    const forward = resolveReactionOrder([alpha, zeta]);
    const reverse = resolveReactionOrder([zeta, alpha]);
    expect(forward).toEqual([STEAM_AREA_ID]);
    expect(reverse).toEqual(forward);
  });
});

function placePair(first: string, second: string): AreaSystem {
  const areas = new AreaSystem(buildAreaTestContent(), flatAreaWorld());
  areas.place(areaPlacement(first));
  areas.place(areaPlacement(second));
  return areas;
}

function areaPlacement(defId: string) {
  return { defId, x: X, y: Y, steps: 0 };
}

function replacementReaction(id: string, area: string) {
  return {
    id,
    priority: 10,
    when: ["fire", "wet"],
    actions: [
      { op: "remove", tag: "fire" },
      { op: "remove", tag: "wet" },
      { op: "add", area },
    ],
  };
}

function resolveReactionOrder(reactions: unknown[]): string[] {
  const content = buildAreaTestContent(reactions);
  expect(content.areaReactions.map((reaction) => reaction.id))
    .toEqual(["alpha-steam", "zeta-smoke"]);
  const areas = new AreaSystem(content, flatAreaWorld());
  areas.place(areaPlacement(WET_AREA_ID));
  areas.place(areaPlacement(FIRE_AREA_ID));
  return areas.defsAt(X, Y);
}
