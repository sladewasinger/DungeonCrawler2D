import { beforeEach, describe, expect, it, vi } from "vitest";
import { destroyChunkVisual, type ChunkVisual, type ChunkVisualBuilder } from "./chunkVisual.js";
import { TerrainRenderer } from "./index.js";
import type { ChunkCoord } from "./streaming.js";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("./chunkVisual.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chunkVisual.js")>();
  return { ...actual, destroyChunkVisual: vi.fn() };
});

interface TerrainRendererHarness {
  advanceBuild(viewKeys: ReadonlySet<string>): void;
}

describe("TerrainRenderer page-budget recovery", () => {
  beforeEach(() => {
    vi.mocked(destroyChunkVisual).mockClear();
  });

  it("continues a blocked rotation after releasing its stale replacement", () => {
    const stale = { cx: 0, cy: 0 } as ChunkVisual;
    const replacement = { cx: 0, cy: 0 } as ChunkVisual;
    let steps = 0;
    const builder = {
      cx: 0,
      cy: 0,
      get pageBudgetBlocked() {
        return steps === 1;
      },
      step: vi.fn(() => (++steps === 1 ? null : replacement)),
      cancel: vi.fn(),
    } satisfies ChunkVisualBuilder;
    const builders = new Map<string, ChunkVisualBuilder>([["0,0", builder]]);
    const visuals = new Map<string, ChunkVisual>([["0,0", stale]]);
    const bakeQueue: ChunkCoord[] = [];
    const budgetBlockedKeys = new Set(["1,0"]);
    const capacityReleaseBuildKeys = new Set<string>();
    const renderer = Object.create(TerrainRenderer.prototype) as TerrainRendererHarness;
    Object.assign(renderer, {
      builders, visuals, bakeQueue, budgetBlockedKeys, capacityReleaseBuildKeys,
    });

    renderer.advanceBuild(new Set(["0,0"]));
    expect(destroyChunkVisual).toHaveBeenCalledWith(stale);
    expect(builders.has("0,0")).toBe(true);
    expect(capacityReleaseBuildKeys).toEqual(new Set(["0,0"]));

    renderer.advanceBuild(new Set(["0,0"]));
    expect(visuals.get("0,0")).toBe(replacement);
    expect(builders.size).toBe(0);
    expect(capacityReleaseBuildKeys.size).toBe(0);
    expect(bakeQueue).toEqual([{ cx: 1, cy: 0 }]);
    expect(budgetBlockedKeys.size).toBe(0);
    expect(builder.cancel).not.toHaveBeenCalled();
  });
});
