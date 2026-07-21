// Generic fixed-size resource pool for the strip-atlas pages (chunkVisual.ts):
// creating and destroying framebuffer-backed textures every chunk load/unload
// stalls the GL pipeline (measured 480ms teleport-burst frames on the SwiftShader
// harness vs ~150 with reuse), so released pages park in a bounded spare list and
// the next bake recycles one instead of allocating. Policy only — the Phaser
// create/recycle/destroy calls are injected, so tests drive it with fakes.
export interface PagePoolHooks<T> {
  /** Allocates a brand-new page (already blank — no recycle pass needed). */
  create(): T;
  /** Restores a spare page to blank before reuse (clear pixels, purge frames). */
  recycle(page: T): void;
  /** Really frees a page the spare list has no room for. */
  destroy(page: T): void;
  /** Spare-list cap: sized to survive a full-view invalidate+redrain (camera
   * rotation releases every resident page, then reacquires them the same frame). */
  maxSpare: number;
}

export class PagePool<T> {
  private readonly spare: T[] = [];

  constructor(private readonly hooks: PagePoolHooks<T>) {}

  /** A blank page: a recycled spare when one is parked, else a fresh allocation. */
  acquire(): T {
    const parked = this.spare.pop();
    if (parked !== undefined) {
      this.hooks.recycle(parked);
      return parked;
    }
    return this.hooks.create();
  }

  /** Parks `page` for reuse, or destroys it when the spare list is full. */
  release(page: T): void {
    if (this.spare.length < this.hooks.maxSpare) this.spare.push(page);
    else this.hooks.destroy(page);
  }

  get spareCount(): number {
    return this.spare.length;
  }
}
