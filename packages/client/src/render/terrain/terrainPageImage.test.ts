import { describe, expect, it, vi } from "vitest";
import { createTerrainPageImage } from "./terrainPageImage.js";

describe("createTerrainPageImage", () => {
  it("positions bake pixels in display space and scales exactly once", () => {
    const calls: Array<[string, unknown]> = [];
    const image = {
      setOrigin: vi.fn((x: number, y: number) => {
        calls.push(["origin", [x, y]]);
        return image;
      }),
      setScale: vi.fn((scale: number) => {
        calls.push(["scale", scale]);
        return image;
      }),
      setDepth: vi.fn(() => image),
      setName: vi.fn(() => image),
      setVisible: vi.fn(() => image),
    };
    const add = { image: vi.fn(() => image) };

    createTerrainPageImage({ add } as never, -16, 32, {} as never, 7, "terrain", "s0");

    expect(add.image).toHaveBeenCalledWith(-48, 96, {}, "s0");
    expect(calls).toEqual([["origin", [0, 0]], ["scale", 3]]);
    expect(image.setDepth).toHaveBeenCalledWith(7);
    expect(image.setVisible).toHaveBeenCalledWith(false);
  });
});
