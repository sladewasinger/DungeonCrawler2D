/** Renderer-neutral world-space visibility consumed by presentation systems. */
export interface WorldPresentationVisibility {
  readonly revision: number;
  readonly backgroundColor?: string;
  isWorldPositionVisible(x: number, y: number): boolean;
}
