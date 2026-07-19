// Shrine landmark (warren district): a small raised dais in an open
// courtyard, ringed by a low wall with gates wherever the corridor network
// crosses it — an intimate plaza at the super-chunk's heart.

import { CHUNK_SIZE, TILE } from "../../types.js";
import { forEachLandmarkTile, landmarkCenter, onCorridor } from "./shared.js";

const DAIS_RADIUS = 4;
const RING_RADIUS = 6;
// A small decorative bump beside the corridor's own flush passthrough
// (see `carved` below) — never load-bearing for reachability, so it
// simply halves with the z-scale doctrine, no ramp needed.
export const DAIS_HEIGHT = 0.5;

export function stampShrine(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  corridorCarved: Uint8Array,
  tiles: Uint8Array,
  height: Float32Array,
): void {
  const center = landmarkCenter(worldSeed, floor, cx, cy);
  forEachLandmarkTile(center, RING_RADIUS, (lx, ly, dx, dy) => {
    const i = ly * CHUNK_SIZE + lx;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    const carved = onCorridor(corridorCarved, CHUNK_SIZE, lx, ly);

    if (d <= DAIS_RADIUS) {
      tiles[i] = TILE.Floor;
      height[i] = carved ? 0 : DAIS_HEIGHT;
    } else if (d < RING_RADIUS) {
      tiles[i] = TILE.Floor;
      height[i] = 0;
    } else if (d === RING_RADIUS && !carved) {
      tiles[i] = TILE.Wall;
      height[i] = 0;
    }
  });
}
