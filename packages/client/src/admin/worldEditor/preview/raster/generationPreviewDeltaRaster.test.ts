import { describe, expect, it } from "vitest";
import { createGenerationPreviewDeltaRaster } from "./generationPreviewDeltaRaster.js";

describe("generation preview delta raster", () => {
  it("maps each changed floor cell to exactly one native raster pixel", () => {
    const raster = createGenerationPreviewDeltaRaster(
      new Uint8Array([0, 1, 0, 0, 0, 1]),
      3,
      2,
    );
    const opaquePixels = Array.from({ length: 6 }, (_value, index) => raster.pixels[index * 4 + 3])
      .filter((alpha) => alpha !== 0);
    expect(raster).toMatchObject({ width: 3, height: 2 });
    expect(opaquePixels).toEqual([150, 150]);
  });
});
