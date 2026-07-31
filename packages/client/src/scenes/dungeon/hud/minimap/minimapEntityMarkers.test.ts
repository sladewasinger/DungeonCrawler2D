import { describe, expect, it } from "vitest";
import type { Connection } from "../../../../net/connection/connection.js";
import type { RemoteEntity } from "../../../../net/interpolation/interpolate.js";
import { resolveMinimapEntityMarkers } from "./minimapEntityMarkers.js";

describe("minimap entity markers", () => {
  it("classifies self, enemies, ordinary players, and party members without duplicates", () => {
    const markers = resolveMinimapEntityMarkers(markerConnection());

    expect(markers).toEqual([
      { kind: "self", x: 1, y: 2 },
      { kind: "enemy", x: 3, y: 4 },
      { kind: "party", x: 5, y: 6 },
      { kind: "player", x: 7, y: 8 },
      { kind: "party", x: 9, y: 10 },
    ]);
  });
});

function markerConnection(): Connection {
  return {
    welcome: { playerId: "self" },
    body: { x: 1, y: 2 },
    party: {
      members: [
        { id: "party-visible", x: 5, y: 6 },
        { id: "party-remote", x: 9, y: 10 },
        { id: "self", x: 1, y: 2 },
      ],
    },
    entities: new Map([
      ["self", remote("player", 1, 2)],
      ["enemy", remote("enemy", 3, 4)],
      ["party-visible", remote("player", 5, 6)],
      ["ordinary-player", remote("player", 7, 8)],
    ]),
  } as unknown as Connection;
}

function remote(kind: "enemy" | "player", x: number, y: number): RemoteEntity {
  return { snap: { kind, x, y } } as unknown as RemoteEntity;
}
