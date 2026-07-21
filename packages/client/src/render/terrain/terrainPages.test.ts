import { describe, expect, it } from "vitest";
import { pagePoolFor } from "./terrainPages.js";

describe("terrain page recycling", () => {
  it("keeps Phaser's base frame while removing atlas strip frames", () => {
    const removed: string[] = [];
    let cleared = false;
    const page = {
      getFrameNames: () => ["__BASE", "s0", "s1"],
      remove: (name: string) => removed.push(name),
      clear: () => {
        cleared = true;
      },
    };
    const pool = pagePoolFor({} as never, "strip");

    pool.release(page as never);
    expect(pool.acquire()).toBe(page);
    expect(removed).toEqual(["s0", "s1"]);
    expect(cleared).toBe(true);
  });
});
