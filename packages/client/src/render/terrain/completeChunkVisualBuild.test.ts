import { describe, expect, it, vi } from "vitest";
import {
  completeChunkVisualBuild,
  TerrainPageBudgetExhaustedError,
} from "./completeChunkVisualBuild.js";
import type { ChunkVisualBuilder } from "./chunkVisualTypes.js";

describe("completeChunkVisualBuild", () => {
  it("fails immediately and cancels partial resources when the page budget blocks", () => {
    const cancel = vi.fn();
    let steps = 0;
    const builder = {
      cx: 4,
      cy: -2,
      pageBudgetBlocked: true,
      step: () => {
        steps++;
        return null;
      },
      cancel,
    } satisfies ChunkVisualBuilder;

    expect(() => completeChunkVisualBuild(builder)).toThrow(
      new TerrainPageBudgetExhaustedError(4, -2),
    );
    expect(steps).toBe(1);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("allows ordinary incremental phases to finish synchronously", () => {
    const visual = { cx: 1, cy: 2 } as never;
    let steps = 0;
    const builder = {
      cx: 1,
      cy: 2,
      pageBudgetBlocked: false,
      step: () => (++steps === 3 ? visual : null),
      cancel: vi.fn(),
    } satisfies ChunkVisualBuilder;

    expect(completeChunkVisualBuild(builder)).toBe(visual);
    expect(steps).toBe(3);
    expect(builder.cancel).not.toHaveBeenCalled();
  });
});
