import type { AdminPlayer } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { AdminPlayerSelection } from "./adminPlayerSelection.js";

describe("admin player selection", () => {
  it("keeps a selected player separate from the tracked spectator target", () => {
    const selection = new AdminPlayerSelection();
    const players = [player("one"), player("two")];
    selection.select("two");
    selection.sync({ players, spectatorMode: "off", spectatorTargetId: null });

    expect(selection.selectedPlayerId).toBe("two");

    selection.sync({ players, spectatorMode: "track", spectatorTargetId: "one" });
    expect(selection.selectedPlayerId).toBe("two");
  });

  it("selects the tracked player only when no player is already selected", () => {
    const selection = new AdminPlayerSelection();
    const players = [player("one"), player("two")];

    selection.sync({ players, spectatorMode: "track", spectatorTargetId: "one" });

    expect(selection.selectedPlayerId).toBe("one");
  });

  it("clears a selected player after they disconnect", () => {
    const selection = new AdminPlayerSelection();
    selection.select("one");
    selection.sync({ players: [], spectatorMode: "off", spectatorTargetId: null });

    expect(selection.selectedPlayerId).toBeNull();
  });
});

function player(playerId: string): AdminPlayer {
  return {
    playerId,
    profileId: `profile-${playerId}`,
    name: playerId,
    level: "dungeon",
    floor: 1,
    x: 0.5,
    y: 0.5,
    z: 0,
    hp: 10,
    maxHp: 10,
    downed: false,
    god: false,
    handicapped: false,
    admin: false,
    statuses: [],
    connected: true,
    clientId: `client-${playerId}`,
  };
}
