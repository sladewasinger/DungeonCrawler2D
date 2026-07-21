import { describe, expect, it } from "vitest";
import { PagePool } from "./pagePool.js";

interface FakePage {
  id: number;
  recycled: number;
  destroyed: boolean;
}

function makePool(maxSpare: number) {
  let nextId = 0;
  const created: FakePage[] = [];
  const pool = new PagePool<FakePage>({
    create: () => {
      const page = { id: nextId++, recycled: 0, destroyed: false };
      created.push(page);
      return page;
    },
    recycle: (page) => {
      page.recycled++;
    },
    destroy: (page) => {
      page.destroyed = true;
    },
    maxSpare,
  });
  return { pool, created };
}

describe("PagePool", () => {
  it("creates fresh pages without a recycle pass when the spare list is empty", () => {
    const { pool, created } = makePool(4);
    const a = pool.acquire();
    expect(created).toHaveLength(1);
    expect(a.recycled).toBe(0);
  });

  it("recycles the most recently released page instead of allocating", () => {
    const { pool, created } = makePool(4);
    const a = pool.acquire();
    pool.release(a);
    expect(pool.spareCount).toBe(1);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(b.recycled).toBe(1); // recycled exactly once, on reuse
    expect(created).toHaveLength(1); // no second allocation
    expect(pool.spareCount).toBe(0);
  });

  it("destroys releases beyond maxSpare", () => {
    const { pool } = makePool(2);
    const pages = [pool.acquire(), pool.acquire(), pool.acquire()];
    for (const p of pages) pool.release(p);
    // Hand-derived with cap 2: first two park, third destroys.
    expect(pool.spareCount).toBe(2);
    expect(pages[0]!.destroyed).toBe(false);
    expect(pages[1]!.destroyed).toBe(false);
    expect(pages[2]!.destroyed).toBe(true);
  });

  it("survives a full release-then-reacquire cycle (the rotation invalidate+drain shape)", () => {
    const { pool, created } = makePool(8);
    const first = [pool.acquire(), pool.acquire(), pool.acquire()];
    for (const p of first) pool.release(p);
    const second = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(created).toHaveLength(3); // every page reused, none allocated twice
    expect(new Set(second)).toEqual(new Set(first));
  });
});
