import { describe, expect, it } from "vitest";
import { generateChunk } from "./chunkGenerator.js";
import { CHUNK_SIZE, GroundKind, PropKind, worldTileIndex } from "./types.js";

describe("chunkGenerator", () => {
  it("generates byte-identical chunks deterministically for identical seeds", () => {
    const a = generateChunk(4242, 0, 0);
    const b = generateChunk(4242, 0, 0);
    expect(Array.from(a.ground)).toEqual(Array.from(b.ground));
    expect(Array.from(a.elevation)).toEqual(Array.from(b.elevation));
    expect(Array.from(a.stairs)).toEqual(Array.from(b.stairs));
    expect(a.props).toEqual(b.props);
    expect(a.lights).toEqual(b.lights);
  });

  it("keeps the spawn glade clear and places a warm campfire with point light", () => {
    const originChunk = generateChunk(1337, 0, 0);
    const spawnIdx = worldTileIndex(0, 0);
    expect(originChunk.ground[spawnIdx]).toBe(GroundKind.DirtPath);
    const campfire = originChunk.props.find((p) => p.kind === PropKind.Campfire);
    expect(campfire).toBeDefined();
    expect(originChunk.lights.some((light) => light.kind === "campfire")).toBe(true);
    const blockersAtOrigin = originChunk.props.filter(
      (p) => p.blocksMovement && Math.hypot(p.x, p.y) < 2,
    );
    expect(blockersAtOrigin).toHaveLength(0);
  });

  it("includes walkable stairs on the nearby highland plateau", () => {
    const nwChunk = generateChunk(1337, -1, -1);
    const lx = CHUNK_SIZE - 10;
    const ly = CHUNK_SIZE - 7;
    expect(nwChunk.stairs[worldTileIndex(lx, ly)]).toBe(1);
  });
});
