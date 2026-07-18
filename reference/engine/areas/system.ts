import type { ContentRegistry } from "../effects/types";
import type { WorldView } from "../world/types";

/**
 * Tile-region area effects (Epic 5): the ground participates in the
 * effect system. One authoritative instance runs on the game server;
 * clients only render replicated tiles.
 *
 * Height-awareness: buoyancy -1 areas (heavy gas, liquids) spread only
 * to equal-or-lower tiles; +1 areas (smoke, steam) only to equal-or-
 * higher. Sanctuary tiles never host hostile areas — fire dies at the
 * safe-room threshold.
 */

export interface AreaWorld extends WorldView {
  isSanctuary(x: number, y: number): boolean;
}

interface AreaTile {
  defId: string;
  remaining: number;
  /** Spread generations from the origin (bounds runaway fires). */
  steps: number;
}

/** Same-tile meetings: first-listed pair wins, replaced by `becomes`. */
const AREA_MEETS: Array<{ a: string; b: string; becomes: string | null }> = [
  { a: "fire", b: "wet", becomes: "area-steam" },
  { a: "fire", b: "oil", becomes: "area-fire" },
  { a: "fire", b: "steam", becomes: "area-steam" },
];

const key = (x: number, y: number) => `${x},${y}`;

export class AreaSystem {
  private readonly tiles = new Map<string, AreaTile>();
  /** Tiles changed since last drain — for AOI replication. */
  private dirty = new Map<string, { x: number; y: number; defId: string | null }>();

  constructor(
    private readonly content: ContentRegistry,
    private readonly world: AreaWorld,
  ) {}

  get size(): number {
    return this.tiles.size;
  }

  defAt(x: number, y: number): string | null {
    return this.tiles.get(key(x, y))?.defId ?? null;
  }

  /** Does the area at (x,y) carry this tag? */
  hasTagAt(x: number, y: number, tag: string): boolean {
    const t = this.tiles.get(key(x, y));
    if (!t) return false;
    return this.content.areas.get(t.defId)?.tags.includes(tag) ?? false;
  }

  /** Place an area blob (impact of a molotov-alike, effect primitive…). */
  spawn(defId: string, cx: number, cy: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.hypot(dx, dy) > radius + 0.01) continue;
        this.place(defId, cx + dx, cy + dy, 0);
      }
    }
  }

  /**
   * Put one tile of an area, resolving same-tile meetings (fire onto
   * wet ⇒ steam) and refusing hostile areas on sanctuary ground.
   */
  place(defId: string, x: number, y: number, steps: number): void {
    const def = this.content.areas.get(defId);
    if (!def) return;
    if (!this.world.isWalkable(x, y)) return;
    if (def.tags.includes("hostile") && this.world.isSanctuary(x, y)) return;

    const existing = this.tiles.get(key(x, y));
    if (existing && existing.defId !== defId) {
      const existingDef = this.content.areas.get(existing.defId);
      for (const rule of AREA_MEETS) {
        const pair = [
          def.tags.includes(rule.a) && existingDef?.tags.includes(rule.b),
          def.tags.includes(rule.b) && existingDef?.tags.includes(rule.a),
        ];
        if (pair[0] || pair[1]) {
          if (rule.becomes === null) {
            this.remove(x, y);
          } else if (rule.becomes === defId || rule.becomes === existing.defId) {
            this.set(x, y, { defId: rule.becomes, remaining: this.duration(rule.becomes), steps });
          } else {
            this.set(x, y, {
              defId: rule.becomes,
              remaining: this.duration(rule.becomes),
              steps: 0,
            });
          }
          return;
        }
      }
    }
    this.set(x, y, { defId, remaining: def.duration, steps });
  }

  remove(x: number, y: number): void {
    if (this.tiles.delete(key(x, y))) {
      this.dirty.set(key(x, y), { x, y, defId: null });
    }
  }

  private set(x: number, y: number, tile: AreaTile): void {
    this.tiles.set(key(x, y), tile);
    this.dirty.set(key(x, y), { x, y, defId: tile.defId });
  }

  private duration(defId: string): number {
    return this.content.areas.get(defId)?.duration ?? 1;
  }

  /** Advance decay + spread. rng must be the server's seeded Rng. */
  tick(dt: number, rng: () => number): void {
    const spreads: Array<{ defId: string; x: number; y: number; steps: number }> = [];
    for (const [k, tile] of this.tiles) {
      tile.remaining -= dt;
      if (tile.remaining <= 0) {
        this.tiles.delete(k);
        const [x, y] = k.split(",").map(Number) as [number, number];
        this.dirty.set(k, { x, y, defId: null });
        continue;
      }
      const def = this.content.areas.get(tile.defId);
      if (!def?.spread || tile.steps >= def.spread.maxSteps) continue;
      if (rng() >= def.spread.chance * dt) continue;

      const [x, y] = k.split(",").map(Number) as [number, number];
      const h = this.world.heightAt(x, y);
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const;
      const candidates = neighbors.filter(([nx, ny]) => {
        if (!this.world.isWalkable(nx, ny)) return false;
        const nh = this.world.heightAt(nx, ny);
        if (def.buoyancy === -1 && nh > h + 0.01) return false; // sinks/flows down
        if (def.buoyancy === 1 && nh < h - 0.01) return false; // rises
        if (def.spread!.ontoAreaTag) {
          return this.hasTagAt(nx, ny, def.spread!.ontoAreaTag);
        }
        return !this.tiles.has(key(nx, ny));
      });
      if (candidates.length === 0) continue;
      const [nx, ny] = candidates[Math.floor(rng() * candidates.length)]!;
      spreads.push({ defId: tile.defId, x: nx, y: ny, steps: tile.steps + 1 });
    }
    for (const s of spreads) this.place(s.defId, s.x, s.y, s.steps);
  }

  /** Changed tiles since last call (for replication); clears the buffer. */
  drainDirty(): Array<{ x: number; y: number; defId: string | null }> {
    const out = [...this.dirty.values()];
    this.dirty.clear();
    return out;
  }

  /** All live tiles (for late-join snapshots). */
  allTiles(): Array<{ x: number; y: number; defId: string }> {
    const out: Array<{ x: number; y: number; defId: string }> = [];
    for (const [k, tile] of this.tiles) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      out.push({ x, y, defId: tile.defId });
    }
    return out;
  }
}
