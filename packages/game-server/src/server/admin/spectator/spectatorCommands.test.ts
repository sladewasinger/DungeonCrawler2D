import { describe, expect, it } from "vitest";
import type { AdminPlayer } from "@dc2d/engine";
import { executeSpectatorCommand } from "./spectatorCommands.js";
import { newSpectatorSession } from "./spectatorSession.js";

const player = (playerId: string): AdminPlayer => ({
  playerId, profileId: `profile-${playerId}`, name: playerId, level: "dungeon", floor: 1,
  x: 0, y: 0, z: 0, hp: 10, maxHp: 10, downed: false, god: false, handicapped: false,
  statuses: [], connected: true, clientId: `client-${playerId}`, admin: false,
});

describe("admin spectator commands", () => {
  it("tracks and cycles through connected players", () => {
    const spectator = newSpectatorSession();
    const players = [player("one"), player("two")];
    expect(executeSpectatorCommand(spectator, { op: "spectate", playerId: "one" }, players).ok).toBe(true);
    expect(spectator.playerId).toBe("one");
    executeSpectatorCommand(spectator, { op: "spectator", action: "cycle", direction: "next" }, players);
    expect(spectator.playerId).toBe("two");
  });

  it("starts previous/next cycling at the expected end while in free camera", () => {
    const players = [player("one"), player("two"), player("three")];
    const previous = newSpectatorSession();
    const next = newSpectatorSession();

    executeSpectatorCommand(previous, { op: "spectator", action: "cycle", direction: "previous" }, players);
    executeSpectatorCommand(next, { op: "spectator", action: "cycle", direction: "next" }, players);

    expect(previous.playerId).toBe("three");
    expect(next.playerId).toBe("one");
  });
});
