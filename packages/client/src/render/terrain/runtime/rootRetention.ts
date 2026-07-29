import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";
import type { TerrainRoot } from "./root.js";

interface TerrainRootRetentionOptions {
  readonly capacity: number;
  readonly create: (orientation: ViewOrientation) => TerrainRoot;
  readonly destroy: (root: TerrainRoot) => void;
}

/** Keeps the most recently used orientation roots while protecting an active swap. */
export class TerrainRootRetention {
  private readonly roots = new Map<ViewOrientation, TerrainRoot>();

  constructor(private readonly options: TerrainRootRetentionOptions) {
    if (options.capacity < 1) throw new Error("Terrain root capacity must be positive");
  }

  acquire(orientation: ViewOrientation): TerrainRoot {
    const existing = this.roots.get(orientation);
    if (!existing) return this.create(orientation);
    this.roots.delete(orientation);
    this.roots.set(orientation, existing);
    return existing;
  }

  retain(protectedOrientations: ReadonlySet<ViewOrientation>): void {
    while (this.roots.size > this.options.capacity) {
      const orientation = this.oldestUnprotected(protectedOrientations);
      if (orientation === undefined) return;
      this.options.destroy(this.roots.get(orientation)!);
      this.roots.delete(orientation);
    }
  }

  values(): IterableIterator<TerrainRoot> {
    return this.roots.values();
  }

  clear(): void {
    for (const root of this.roots.values()) this.options.destroy(root);
    this.roots.clear();
  }

  get size(): number {
    return this.roots.size;
  }

  private create(orientation: ViewOrientation): TerrainRoot {
    const root = this.options.create(orientation);
    this.roots.set(orientation, root);
    return root;
  }

  private oldestUnprotected(
    protectedOrientations: ReadonlySet<ViewOrientation>,
  ): ViewOrientation | undefined {
    for (const orientation of this.roots.keys()) {
      if (!protectedOrientations.has(orientation)) return orientation;
    }
    return undefined;
  }
}
