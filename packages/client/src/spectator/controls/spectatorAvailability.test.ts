import { describe, expect, it } from "vitest";
import { spectatorPresentationAvailable } from "./spectatorAvailability.js";

describe("spectator availability", () => {
  it("enters only after both a roster target and its world are ready", () => {
    expect(available([], null, false)).toBe(false);
    expect(available(["p1"], "p1", false)).toBe(false);
    expect(available(["p1"], "p1", true)).toBe(true);
  });

  it("returns to empty when the target leaves the roster", () => {
    expect(available(["p1"], "p1", true)).toBe(true);
    expect(available([], "p1", true)).toBe(false);
  });
});

function available(
  playerIds: readonly string[],
  targetId: string | null,
  hasWorld: boolean,
): boolean {
  return spectatorPresentationAvailable({ playerIds, targetId, hasWorld });
}
