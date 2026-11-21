import { FLOOR_SEMANTIC, type FloorGenerationSnapshot } from "@dc2d/engine";
import { expect, it } from "vitest";
import { createGenerationPreviewRaster } from "./generationPreviewRaster.js";

it("preserves a one-cell crossing in the native full-floor raster", () => {
  const semantic = new Uint8Array(16);
  semantic[5] = FLOOR_SEMANTIC.Transition;
  const snapshot = {
    bounds: { minX: 0, minY: 0, width: 4, height: 4, maxX: 3, maxY: 3 },
    semantic,
    height: new Float32Array(16),
    region: new Uint16Array(16),
    featureIds: new Int16Array(16).fill(-1),
  } as unknown as FloorGenerationSnapshot;
  const raster = createGenerationPreviewRaster(snapshot);
  const crossing = [...raster.pixels.slice(5 * 4, 5 * 4 + 4)];
  const solid = [...raster.pixels.slice(0, 4)];

  expect(raster).toMatchObject({ width: 4, height: 4 });
  expect(crossing).not.toEqual(solid);
});
