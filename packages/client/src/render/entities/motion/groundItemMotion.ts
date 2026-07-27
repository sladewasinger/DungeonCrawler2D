// Pure ground-item motion math: bob + glint per VISUAL_DIRECTION's "no static entities" —
// a gentle vertical bob plus a brighter tint pulse standing in for a light glint.
const BOB_AMPLITUDE_PX = 3;
const BOB_PERIOD_MS = 1400;
const GLINT_PERIOD_MS = 900;

/** Vertical bob offset (px) for elapsed ms — negative lifts the sprite up on screen. */
export function bobOffsetPx(elapsedMs: number): number {
  return -Math.abs(Math.sin((elapsedMs / BOB_PERIOD_MS) * Math.PI * 2)) * BOB_AMPLITUDE_PX;
}

/** Glint strength 0..1 for elapsed ms, spiking briefly once per GLINT_PERIOD_MS. */
export function glintStrength(elapsedMs: number): number {
  const phase = (elapsedMs % GLINT_PERIOD_MS) / GLINT_PERIOD_MS;
  return Math.max(0, Math.sin(phase * Math.PI * 2));
}
