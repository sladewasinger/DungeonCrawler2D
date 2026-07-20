// Sub-integer height legibility: a flat top's own face/edge treatment only
// fires at a WALL_FACE_MIN_DROP (0.75) drop — anything shallower (a stair's
// RUN_PADDING ramp, an authored "pocket" dip, a repaired-cliff half-step)
// today renders identical to plain flat floor. Any ground cell whose height
// differs from a neighbor by [MIN_DELTA, WALL_FACE_MIN_DROP) gets a subtle
// directional shadow line on that lower side — the pocket/padding legibility
// fix, independent of (and skipped on) tiles the stair-tread renderer already
// treats.
import { WALL_FACE_MIN_DROP } from "@dc2d/engine";

const MIN_DELTA = 0.25;

export interface SlopeRead {
  readonly heightAt: (wx: number, wy: number) => number;
}

export interface SubtleSlopeEdges {
  readonly north: boolean;
  readonly south: boolean;
  readonly east: boolean;
  readonly west: boolean;
  /** 0..1: how far into the [MIN_DELTA, WALL_FACE_MIN_DROP) band the steepest qualifying edge sits. */
  readonly strength: number;
}

const NONE: SubtleSlopeEdges = { north: false, south: false, east: false, west: false, strength: 0 };

/** True when THIS tile sits lower than the neighbor by a shallow, currently-invisible margin. */
function lowerByBand(here: number, neighbor: number): number | null {
  const delta = neighbor - here;
  if (delta < MIN_DELTA || delta >= WALL_FACE_MIN_DROP) return null;
  return delta;
}

/**
 * Shadow-line edges for a plain ground tile (never called on face/pit-face
 * cells, which own their own boundary art) — one line per neighbor this
 * tile sits shallowly below, strongest edge driving the overall `strength`.
 */
export function subtleSlopeEdgesAt(world: SlopeRead, wx: number, wy: number): SubtleSlopeEdges {
  const h = world.heightAt(wx, wy);
  const n = lowerByBand(h, world.heightAt(wx, wy - 1));
  const s = lowerByBand(h, world.heightAt(wx, wy + 1));
  const e = lowerByBand(h, world.heightAt(wx + 1, wy));
  const w = lowerByBand(h, world.heightAt(wx - 1, wy));
  if (n === null && s === null && e === null && w === null) return NONE;
  const deltas = [n, s, e, w].filter((d): d is number => d !== null);
  const strongest = Math.max(...deltas);
  const strength = (strongest - MIN_DELTA) / (WALL_FACE_MIN_DROP - MIN_DELTA);
  return { north: n !== null, south: s !== null, east: e !== null, west: w !== null, strength };
}
