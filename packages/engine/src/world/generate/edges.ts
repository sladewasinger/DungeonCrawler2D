// Cross-chunk connectivity contract: each chunk border has one jittered
// anchor point + width, keyed by an edge id that's the SAME regardless of
// which of the two neighboring chunks asks — chunk (cx,cy)'s east anchor
// and chunk (cx+1,cy)'s west anchor both hash edge id (cx,cy,'V'), so they
// land on identical world coordinates and widths. A chunk's own corridor
// network only has to reach these four points for the cross-chunk
// connectivity guarantee to hold globally.
//
// "Avenues" graft: an edge that crosses a super-chunk (district) boundary
// widens well beyond the ordinary 1-3 tile capillary corridor — a legible
// arterial road hierarchy on top of the connectivity guarantee.

import { hash2D, mixSeeds } from "../../core/rng.js";
import { avenueBetween } from "./district.js";
import type { Point, Side } from "./types.js";

const MARGIN = 6; // keep anchors off the chunk corners
const WIDTH_MIN = 1;
const WIDTH_MAX = 3;
const AVENUE_WIDTH_MIN = 4;
const AVENUE_WIDTH_MAX = 6;
const V_SALT = 0xed6e;
const H_SALT = 0xed6f;

export interface EdgeAnchor {
  readonly side: Side;
  readonly point: Point;
  readonly width: number;
}

function edgeJitter(seed: number, ex: number, ey: number, salt: number, span: number): number {
  return MARGIN + (hash2D(mixSeeds(seed, salt), ex, ey) % span);
}

function edgeWidth(seed: number, ex: number, ey: number, salt: number, avenue: boolean): number {
  const min = avenue ? AVENUE_WIDTH_MIN : WIDTH_MIN;
  const max = avenue ? AVENUE_WIDTH_MAX : WIDTH_MAX;
  return min + (hash2D(mixSeeds(seed, salt ^ 0x7777), ex, ey) % (max - min + 1));
}

/** The four border anchors for chunk (cx, cy), in chunk-local coordinates. */
export function edgeAnchors(seed: number, cx: number, cy: number, chunkSize: number): EdgeAnchor[] {
  const span = chunkSize - 2 * MARGIN;
  const westY = edgeJitter(seed, cx - 1, cy, V_SALT, span);
  const eastY = edgeJitter(seed, cx, cy, V_SALT, span);
  const northX = edgeJitter(seed, cx, cy - 1, H_SALT, span);
  const southX = edgeJitter(seed, cx, cy, H_SALT, span);
  const here = { cx, cy };
  return [
    {
      side: 0,
      point: { x: northX, y: 0 },
      width: edgeWidth(seed, cx, cy - 1, H_SALT, avenueBetween({ cx, cy: cy - 1 }, here)),
    },
    {
      side: 1,
      point: { x: chunkSize - 1, y: eastY },
      width: edgeWidth(seed, cx, cy, V_SALT, avenueBetween(here, { cx: cx + 1, cy })),
    },
    {
      side: 2,
      point: { x: southX, y: chunkSize - 1 },
      width: edgeWidth(seed, cx, cy, H_SALT, avenueBetween(here, { cx, cy: cy + 1 })),
    },
    {
      side: 3,
      point: { x: 0, y: westY },
      width: edgeWidth(seed, cx - 1, cy, V_SALT, avenueBetween({ cx: cx - 1, cy }, here)),
    },
  ];
}
