// Stair tread geometry: subdivides a stair (or RUN_PADDING) tile into thin
// riser lines perpendicular to its climb direction, brighter toward the top
// of the climb — pure math, no Phaser, so a multi-tile run's tread pattern
// is unit-testable independent of rendering.

export const TREAD_COUNT = 4;
/** How much a riser's OWN position within this one tile nudges its brightness, on top of the run-wide t — kept small so the run-wide gradient still dominates. */
const GAP_SHRINK = 0.76;
const RUN_BRIGHTNESS_WEIGHT = 0.2;

export interface TreadRiser {
  /** 0..1 position along the stacking axis (screen space) within this tile. */
  readonly axisFrac: number;
  /** 0..1 brightness, rising toward the climb's high end. */
  readonly brightness: number;
  /** The brighter outer edge where the stair meets its high landing. */
  readonly nosing: boolean;
}

/** True when this direction's climb stacks treads along the Y axis (screen-horizontal lines). */
export function stacksVertically(direction: number): boolean {
  return direction === 0 || direction === 2;
}

/** True when this direction's high end sits at axisFrac 0 (north or west). */
export function highEndAtStart(direction: number): boolean {
  return direction === 0 || direction === 3;
}

function perspectiveBoundaries(count: number): number[] {
  const gaps = Array.from({ length: count }, (_, index) => GAP_SHRINK ** index);
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  let position = 0;
  return gaps.slice(0, -1).map((gap) => {
    position += gap / total;
    return position;
  });
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
  const towardHigh = perspectiveBoundaries(TREAD_COUNT);
  const boundaries = highAtStart
    ? towardHigh
    : towardHigh.map((boundary) => 1 - boundary).reverse();
  const interior = boundaries.map((boundary) => {
    const highFrac = highAtStart ? 1 - boundary : boundary;
    const brightness = RUN_BRIGHTNESS_WEIGHT * t +
      (1 - RUN_BRIGHTNESS_WEIGHT) * highFrac;
    return { axisFrac: boundary, brightness: clamp01(brightness), nosing: false };
  });
  return [
    { axisFrac: highAtStart ? 0 : 1, brightness: 1, nosing: true },
    ...interior,
  ].sort((first, second) => first.axisFrac - second.axisFrac);
}
