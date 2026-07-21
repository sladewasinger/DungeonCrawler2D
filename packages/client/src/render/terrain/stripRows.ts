// Occluder-row accounting for a chunk bake: the lazy per-row containers drawTile
// draws into (face bands keyed to their foot row, shifted caps keyed to their own
// row — two separate maps because their depth formulas differ), and the collectors
// that turn each non-empty row into a PendingStrip for the shared strip atlas
// (chunkVisual.ts's bakeStripAtlas).
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { depthForCapOccluder, depthForOccluder } from "../entities/depthSort.js";
import type { OccluderFor } from "./drawTile.js";
import type { CapOccluderFor } from "./occluderBand.js";
import type { StripSpec } from "./stripAtlas.js";

/**
 * One pending occluder strip: a face column bakes its dynamic rows (see
 * occluderBand.ts) into the strip of its ground-adjacent row, so `overhangTiles`
 * records the tallest such row and the bake covers exactly [wy - overhang, wy + 1].
 * Per-strip cost scales with baked height — a fixed MAX_FACE_ROWS-tall strip
 * (the 3 -> 16 pivot) made every visible wall row blit ~16 tiles of mostly
 * transparent pixels each frame, which was the measured e2e keystroke regression.
 */
export interface OccluderRow {
  readonly container: Phaser.GameObjects.Container;
  overhangTiles: number;
}

/**
 * A cell's shifted CAP strip, keyed to its OWN raw row `vy` (never a foot row —
 * a cap's own row is itself walkable ground, unlike a face band's wall cell).
 * Overhangs grow independently: a positive height only ever bleeds up, a
 * negative one only ever bleeds down.
 */
export interface CapRow {
  readonly container: Phaser.GameObjects.Container;
  overhangAbove: number;
  overhangBelow: number;
}

export interface PendingStrip extends StripSpec {
  readonly container: Phaser.GameObjects.Container;
}

/** Builds the occluderFor accessor: lazily creates one container per occluder row,
 * tracking the tallest overhang any caller has asked that row to bake. */
export function makeOccluderFor(scene: Phaser.Scene, rows: Map<number, OccluderRow>): OccluderFor {
  return (wy: number, overhangTiles = 0): Phaser.GameObjects.Container => {
    let row = rows.get(wy);
    if (!row) {
      row = { container: scene.add.container(0, 0), overhangTiles: 0 };
      rows.set(wy, row);
    }
    row.overhangTiles = Math.max(row.overhangTiles, overhangTiles);
    return row.container;
  };
}

/** Builds the capOccluderFor accessor (docs/ELEVATION-PROJECTION.md section 2):
 * a SEPARATE row-map from the face-band `rows` above — a cap's depth formula
 * differs from a band's (see collectCapStrips), so sharing one map would conflate
 * two different depth intents under the same row key. */
export function makeCapOccluderFor(scene: Phaser.Scene, rows: Map<number, CapRow>): CapOccluderFor {
  return (vy: number, overhangAbove = 0, overhangBelow = 0): Phaser.GameObjects.Container => {
    let row = rows.get(vy);
    if (!row) {
      row = { container: scene.add.container(0, 0), overhangAbove: 0, overhangBelow: 0 };
      rows.set(vy, row);
    }
    row.overhangAbove = Math.max(row.overhangAbove, overhangAbove);
    row.overhangBelow = Math.max(row.overhangBelow, overhangBelow);
    return row.container;
  };
}

/** Each non-empty occluder row as a pending strip, exactly tall enough for its own content. */
export function collectFaceStrips(rows: ReadonlyMap<number, OccluderRow>): PendingStrip[] {
  const strips: PendingStrip[] = [];
  for (const [wy, row] of rows) {
    if (row.container.list.length === 0) {
      row.container.destroy(true);
      continue;
    }
    strips.push({
      container: row.container,
      stripTop: (wy - row.overhangTiles) * SCREEN_TILE_PX,
      stripHeight: (row.overhangTiles + 1) * SCREEN_TILE_PX,
      depth: depthForOccluder(wy + 1),
    });
  }
  return strips;
}

/**
 * Each non-empty CAP strip as a pending strip. Depth uses depthForCapOccluder(vy),
 * NOT a band's foot-row depthForOccluder formula: a cap's own row `vy` is
 * walkable — an entity standing anywhere on it (feetWorldY >= vy) must draw IN
 * FRONT of its own cap, while an entity at ANY fractional feet position strictly
 * north (feetWorldY < vy) must be occluded BY it (see depthSort.ts).
 */
export function collectCapStrips(rows: ReadonlyMap<number, CapRow>): PendingStrip[] {
  const strips: PendingStrip[] = [];
  for (const [vy, row] of rows) {
    if (row.container.list.length === 0) {
      row.container.destroy(true);
      continue;
    }
    strips.push({
      container: row.container,
      stripTop: (vy - row.overhangAbove) * SCREEN_TILE_PX,
      stripHeight: (row.overhangAbove + 1 + row.overhangBelow) * SCREEN_TILE_PX,
      depth: depthForCapOccluder(vy),
    });
  }
  return strips;
}
