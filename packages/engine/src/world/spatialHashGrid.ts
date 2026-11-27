/** Zero-string-allocation 2D SpatialHashGrid for O(nearby) server AI, projectile, and AOI queries. */

export interface SpatialPoint {
  readonly x: number;
  readonly y: number;
}

export class SpatialHashGrid<T extends SpatialPoint> {
  private readonly cols = new Map<number, Map<number, T[]>>();
  private readonly activeBuckets: T[][] = [];
  private count = 0;

  constructor(readonly cellSize = 16) {
    if (cellSize <= 0 || !Number.isFinite(cellSize)) throw new Error(`Invalid cellSize: ${cellSize}`);
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    for (const bucket of this.activeBuckets) bucket.length = 0;
    this.activeBuckets.length = 0;
    this.count = 0;
  }

  private getOrCreateBucket(cx: number, cy: number): T[] {
    let col = this.cols.get(cx);
    if (!col) {
      col = new Map<number, T[]>();
      this.cols.set(cx, col);
    }
    let bucket = col.get(cy);
    if (!bucket) {
      bucket = [];
      col.set(cy, bucket);
    }
    if (bucket.length === 0) this.activeBuckets.push(bucket);
    return bucket;
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    this.getOrCreateBucket(cx, cy).push(item);
    this.count += 1;
  }

  insertAll(items: Iterable<T>): void {
    for (const item of items) this.insert(item);
  }

  queryRadius(q: { readonly x: number; readonly y: number; readonly radius: number; readonly out?: T[] }): T[] {
    const out = q.out ?? [];
    const r = Math.max(0, q.radius);
    const rSq = r * r;
    const minCx = Math.floor((q.x - r) / this.cellSize);
    const maxCx = Math.floor((q.x + r) / this.cellSize);
    const minCy = Math.floor((q.y - r) / this.cellSize);
    const maxCy = Math.floor((q.y + r) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      this.scanColumnRadius({ cx, minCy, maxCy, x: q.x, y: q.y, rSq, out });
    }
    return out;
  }

  private pushMatchingRadius(bucket: readonly T[], s: { readonly x: number; readonly y: number; readonly rSq: number; readonly out: T[] }): void {
    for (const item of bucket) {
      const dx = item.x - s.x;
      const dy = item.y - s.y;
      if (dx * dx + dy * dy <= s.rSq) s.out.push(item);
    }
  }

  private scanColumnRadius(s: {
    readonly cx: number; readonly minCy: number; readonly maxCy: number;
    readonly x: number; readonly y: number; readonly rSq: number; readonly out: T[];
  }): void {
    const col = this.cols.get(s.cx);
    if (!col) return;
    for (let cy = s.minCy; cy <= s.maxCy; cy++) {
      const bucket = col.get(cy);
      if (bucket && bucket.length > 0) this.pushMatchingRadius(bucket, s);
    }
  }

  queryAabb(q: {
    readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly out?: T[];
  }): T[] {
    const out = q.out ?? [];
    const minCx = Math.floor(q.minX / this.cellSize);
    const maxCx = Math.floor(q.maxX / this.cellSize);
    const minCy = Math.floor(q.minY / this.cellSize);
    const maxCy = Math.floor(q.maxY / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      this.scanColumnAabb({ cx, minCy, maxCy, minX: q.minX, minY: q.minY, maxX: q.maxX, maxY: q.maxY, out });
    }
    return out;
  }

  private pushMatchingAabb(bucket: readonly T[], s: {
    readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly out: T[];
  }): void {
    for (const item of bucket) {
      if (item.x >= s.minX && item.x <= s.maxX && item.y >= s.minY && item.y <= s.maxY) s.out.push(item);
    }
  }

  private scanColumnAabb(s: {
    readonly cx: number; readonly minCy: number; readonly maxCy: number;
    readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly out: T[];
  }): void {
    const col = this.cols.get(s.cx);
    if (!col) return;
    for (let cy = s.minCy; cy <= s.maxCy; cy++) {
      const bucket = col.get(cy);
      if (bucket && bucket.length > 0) this.pushMatchingAabb(bucket, s);
    }
  }
}
