import { describe, expect, it } from "vitest";
import { parseAdminChatCommand } from "./chatCommands.js";

describe("admin gameplay chat commands", () => {
  it("parses bounded commands into the shared wire command shapes", () => {
    expect(parseAdminChatCommand("/admin heal player-1")).toEqual({ op: "heal", playerId: "player-1" });
    expect(parseAdminChatCommand("/admin map dungeon 2 10.5 -4.5 8")).toEqual({
      op: "map", level: "dungeon", floor: 2, x: 10.5, y: -4.5, radius: 8,
    });
    expect(parseAdminChatCommand("/admin spawn weapon sword 4.5 5.5 dungeon 1")).toEqual({
      op: "spawn", kind: "weapon", defId: "sword", x: 4.5, y: 5.5, level: "dungeon", floor: 1,
    });
    expect(parseAdminChatCommand("/admin spawn pet pet-dino-tard 4.5 5.5 dungeon 1 player-1")).toEqual({
      op: "spawn", kind: "pet", defId: "pet-dino-tard", x: 4.5, y: 5.5, level: "dungeon", floor: 1, ownerPlayerId: "player-1",
    });
    expect(parseAdminChatCommand("/admin map combat-sandbox 1 25 25 12")).toEqual({
      op: "map", level: "combat-sandbox", floor: 1, x: 25, y: 25, radius: 12,
    });
  });

  it("accepts shared spawn-room coordinates for map and spawn commands", () => {
    expect(parseAdminChatCommand("/admin map dungeon 1 -52.5 131087.5 10")).toEqual({
      op: "map", level: "dungeon", floor: 1, x: -52.5, y: 131087.5, radius: 10,
    });
    expect(parseAdminChatCommand("/admin spawn enemy slime -52.5 131087.5 dungeon 1")).toEqual({
      op: "spawn", kind: "enemy", defId: "slime", x: -52.5, y: 131087.5, level: "dungeon", floor: 1,
    });
  });

  it("accepts direct player coordinate teleport commands", () => {
    expect(parseAdminChatCommand("/admin teleport player-1 coordinates -52.5 131087.5"))
      .toEqual({
        op: "teleport",
        playerId: "player-1",
        destination: "coordinates",
        x: -52.5,
        y: 131087.5,
      });
  });

  it("rejects malformed or unbounded commands", () => {
    expect(parseAdminChatCommand("/admin kill player-1 extra")).toBeNull();
    expect(parseAdminChatCommand("/admin map dungeon 2 10 10 99")).toBeNull();
    expect(parseAdminChatCommand("/admin spawn enemy slime 10 10 unknown 1")).toBeNull();
    expect(parseAdminChatCommand("/admin spawn pet pet-dino-tard 10 10 dungeon 1")).toBeNull();
  });
});
