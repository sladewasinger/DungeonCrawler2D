// Pure pool-index arithmetic for BloodDecalPool: grow while under the hard cap,
// otherwise round-robin over existing slots — the "reuse" half of ASSUMPTIONS.md
// #29's pooled cap, split out so cap/reuse behavior is unit-testable apart from Phaser.

/** True while the pool should still allocate a new decal object rather than reuse one. */
export function shouldGrowPool(activeCount: number, cap: number): boolean {
  return activeCount < cap;
}

/** Round-robin slot index once the pool is at its cap; `cursor` is the caller's own
 * monotonic spawn counter, advanced by 1 on every recycle-path spawn. */
export function recycleSlotIndex(cursor: number, cap: number): number {
  return cursor % cap;
}
