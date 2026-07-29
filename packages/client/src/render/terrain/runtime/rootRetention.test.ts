import { describe, expect, it, vi } from "vitest";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { TerrainRoot } from "./root.js";
import { TerrainRootRetention } from "./rootRetention.js";

function fakeRoot(orientation: ViewOrientation): TerrainRoot {
  return { orientation } as TerrainRoot;
}

describe("TerrainRootRetention", () => {
  it("evicts the oldest unprotected root while preserving a rotation pair", () => {
    const destroy = vi.fn();
    const roots = new TerrainRootRetention({
      capacity: 2,
      create: fakeRoot,
      destroy,
    });
    roots.acquire(0);
    roots.acquire(90);
    roots.acquire(0);
    roots.acquire(180);
    roots.retain(new Set<ViewOrientation>([0, 180]));

    expect([...roots.values()].map((root) => root.orientation)).toEqual([0, 180]);
    expect(destroy).toHaveBeenCalledWith(expect.objectContaining({ orientation: 90 }));
  });

  it("destroys every retained root when cleared", () => {
    const destroy = vi.fn();
    const roots = new TerrainRootRetention({
      capacity: 2,
      create: fakeRoot,
      destroy,
    });
    roots.acquire(0);
    roots.acquire(90);
    roots.clear();

    expect(destroy).toHaveBeenCalledTimes(2);
    expect(roots.size).toBe(0);
  });
});
