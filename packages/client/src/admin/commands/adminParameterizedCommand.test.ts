import { describe, expect, it } from "vitest";
import { adminParameterizedCommand } from "./adminParameterizedCommand.js";

describe("parameterized admin controls", () => {
  it("builds a coordinate teleport from the position fields", () => {
    expect(adminParameterizedCommand(
      "teleport-coordinates",
      control("player-1", { "[data-admin-teleport-x]": 12.5, "[data-admin-teleport-y]": -8.5 }),
    ).command).toEqual({
      op: "teleport",
      playerId: "player-1",
      destination: "coordinates",
      x: 12.5,
      y: -8.5,
    });
  });

  it("uses the configured nearby-enemy radius", () => {
    expect(adminParameterizedCommand(
      "kill-enemies",
      control("player-2", { "[data-admin-enemy-radius]": 24 }),
    ).command).toEqual({
      op: "killEnemies",
      centerPlayerId: "player-2",
      radius: 24,
    });
  });
});

function control(
  playerId: string,
  values: Readonly<Record<string, number>>,
): HTMLButtonElement {
  const group = {
    querySelector: (selector: string) => ({ valueAsNumber: values[selector] ?? Number.NaN }),
  };
  return {
    dataset: { playerId },
    closest: () => group,
  } as unknown as HTMLButtonElement;
}
