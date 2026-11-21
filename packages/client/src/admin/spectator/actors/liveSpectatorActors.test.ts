import { describe, expect, it } from "vitest";
import type { AdminMap } from "@dc2d/engine";
import { drawLiveSpectatorActors } from "./liveSpectatorActors.js";
import { createLiveSpectatorView } from "../liveSpectatorView.js";

describe("live spectator actor renderer", () => {
  it("takes the atlas or fallback path for each supported entity kind", () => {
    for (const entity of spectatorMap().entities) {
      const ready = renderEntity(entity, true);
      const expectedAtlas = ["player", "enemy", "item", "weapon", "torch"].includes(entity.kind);
      expect(ready.drawImage, entity.kind).toBe(expectedAtlas ? 1 : 0);
      expect(ready.fillRect, entity.kind).toBe(expectedAtlas ? 0 : 1);

      const fallback = renderEntity(entity, false);
      expect(fallback.drawImage, `${entity.kind} fallback`).toBe(0);
      expect(fallback.fillRect, `${entity.kind} fallback`).toBe(1);
      expect(fallback.fillText, `${entity.kind} fallback label`).toBe(
        ["player", "enemy", "pet"].includes(entity.kind) ? 1 : 0,
      );
    }
    expect(renderEntity(spectatorMap().entities[0]!, true).stroke).toBe(1);
  });
});

interface DrawCounts {
  drawImage: number;
  fillRect: number;
  fillText: number;
  stroke: number;
}

function renderEntity(entity: AdminMap["entities"][number], atlasReady: boolean): DrawCounts {
  const counts: DrawCounts = { drawImage: 0, fillRect: 0, fillText: 0, stroke: 0 };
  const context = fakeContext(counts);
  const map = { ...spectatorMap(), center: { x: entity.x, y: entity.y }, entities: [entity] };
  const view = createLiveSpectatorView({
    map,
    targetId: entity.id === "player" ? entity.id : null,
    canvas: context.canvas,
  });
  drawLiveSpectatorActors({
    context,
    map,
    targetId: "player",
    atlas: fakeImage(atlasReady),
    pets: {},
    view,
  });
  return counts;
}

function fakeContext(counts: DrawCounts): CanvasRenderingContext2D {
  return {
    canvas: { width: 800, height: 450 },
    fillRect: () => { counts.fillRect++; },
    drawImage: () => { counts.drawImage++; },
    fillText: () => { counts.fillText++; },
    stroke: () => { counts.stroke++; },
    beginPath: () => {},
    ellipse: () => {},
    fill: () => {},
    strokeText: () => {},
  } as unknown as CanvasRenderingContext2D;
}

function fakeImage(ready: boolean): HTMLImageElement {
  return { complete: ready, naturalWidth: ready ? 512 : 0 } as HTMLImageElement;
}

function spectatorMap(): AdminMap {
  return {
    level: "dungeon",
    floor: 1,
    center: { x: 0, y: 0 },
    radius: 12,
    cells: [],
    entities: [
      { id: "player", kind: "player", x: 0, y: 0, z: 0 },
      { id: "enemy", kind: "enemy", defId: "slime", x: 1, y: 0, z: 0 },
      { id: "pet", kind: "pet", defId: "pet-dino-tard", x: -1, y: 0, z: 0 },
      { id: "item", kind: "item", defId: "torch", x: 0, y: 1, z: 0 },
      { id: "weapon", kind: "weapon", defId: "sword", x: 1, y: 1, z: 0 },
      { id: "projectile", kind: "projectile", x: -1, y: 1, z: 0 },
      { id: "torch", kind: "torch", defId: "torch", x: 2, y: 0, z: 0 },
    ],
  } as AdminMap;
}
