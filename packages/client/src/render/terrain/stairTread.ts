// Stair tread geometry: subdivides a stair (or RUN_PADDING) tile into thin
// riser lines perpendicular to its climb direction, brighter toward the top
// of the climb — pure math, no Phaser, so a multi-tile run's tread pattern
// is unit-testable independent of rendering.

const TREAD_COUNT = 3;
/** How much a riser's OWN position within this one tile nudges its brightness, on top of the run-wide t — kept small so the run-wide gradient still dominates. */
const LOCAL_GRADIENT = 0.2;

export interface TreadRiser {
  /** 0..1 position along the stacking axis (screen space) within this tile. */
  readonly axisFrac: number;
  /** 0..1 brightness, rising toward the climb's high end. */
  readonly brightness: number;
}

/** True when this direction's climb stacks treads along the Y axis (screen-horizontal lines). */
export function stacksVertically(direction: number): boolean {
  return direction === 0 || direction === 2;
}

/** True when this direction's high end sits at axisFrac 0 (north or west). */
function highEndAtStart(direction: number): boolean {
  return direction === 0 || direction === 3;
}

function bandBoundaries(count: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < count; k++) out.push(k / count);
  return out;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Interior tread-line boundaries for one stair tile: TREAD_COUNT - 1 lines,
 * each riser's brightness rising toward whichever tile edge faces the
 * climb's high end (so a single physical Stairs tile — or a flat padding
 * tile beside one — still reads as several stacked steps, not one blob).
 */
export function treadRisers(direction: number, t: number): TreadRiser[] {
  const highAtStart = highEndAtStart(direction);
  return bandBoundaries(TREAD_COUNT).map((boundary) => {
    const highFrac = highAtStart ? 1 - boundary : boundary;
    const local = (highFrac - 0.5) * LOCAL_GRADIENT;
    return { axisFrac: boundary, brightness: clamp01(t + local) };
  });
}
