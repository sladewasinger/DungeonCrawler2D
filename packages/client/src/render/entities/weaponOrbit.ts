// Self-only weapon-orbit geometry: resolves the live aim angle (mouse-relative on
// desktop, facing-locked on touch), sweeps a persisted angle toward it at a capped
// angular speed so the weapon visibly arcs rather than teleporting, and places a
// sprite on the orbit circle. Kept Phaser-free so the angle math is unit-testable on
// its own; heldWeapon.ts is the only caller that touches a real sprite.
import { MELEE_ARC_COS } from "@dc2d/engine";

/** Radius of the self weapon's idle orbit around the player, in tiles (docs spec: "~0.75 tiles"). */
export const ORBIT_RADIUS_TILES = 0.75;

/** Slew-rate cap for the orbit angle: at most this many radians per second, so a fast
 * mouse flick sweeps into place over a few frames instead of snapping instantly. */
export const MAX_ANGULAR_SPEED_RAD_PER_S = 12;

/** Melee arc half-angle, derived from the shared engine constant — never a hardcoded literal. */
export const MELEE_HALF_ANGLE_RAD = Math.acos(MELEE_ARC_COS);

export type AimSource =
  | { readonly kind: "mouse"; readonly playerScreenX: number; readonly playerScreenY: number; readonly pointerScreenX: number; readonly pointerScreenY: number }
  | { readonly kind: "facing"; readonly faceX: number; readonly faceY: number };

/** The live target angle (radians) the orbit sweeps toward: mouse-relative on desktop, held facing on touch. */
export function resolveAimAngle(source: AimSource): number {
  if (source.kind === "facing") return Math.atan2(source.faceY, source.faceX);
  const dx = source.pointerScreenX - source.playerScreenX;
  const dy = source.pointerScreenY - source.playerScreenY;
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(dy, dx);
}

const TWO_PI = Math.PI * 2;

/** Wraps to (-pi, pi] so angle deltas take the short way around. */
function normalizeAngle(angle: number): number {
  return (((angle % TWO_PI) + TWO_PI + Math.PI) % TWO_PI) - Math.PI;
}

/** Steps `current` toward `target` at up to MAX_ANGULAR_SPEED_RAD_PER_S rad/s — the sweep that keeps the
 * weapon reading as chasing the mouse instead of jumping to it every frame. */
export function stepOrbitAngle(current: number, target: number, dtSeconds: number): number {
  const delta = normalizeAngle(target - current);
  const maxStep = MAX_ANGULAR_SPEED_RAD_PER_S * Math.max(0, dtSeconds);
  if (Math.abs(delta) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxStep);
}

export interface OrbitPosition {
  readonly x: number;
  readonly y: number;
  /** Sprite rotation in radians, pointing outward along the orbit angle. */
  readonly rotation: number;
}

/** Screen position on the orbit circle (radius ORBIT_RADIUS_TILES) around (centerX, centerY) at `angle`. */
export function orbitPosition(centerX: number, centerY: number, angle: number, tilePx: number): OrbitPosition {
  const radiusPx = ORBIT_RADIUS_TILES * tilePx;
  return { x: centerX + Math.cos(angle) * radiusPx, y: centerY + Math.sin(angle) * radiusPx, rotation: angle };
}

/** During the strike telegraph, the weapon sweeps across the melee wedge instead of holding
 * still at `baseAngle` — the "quick swing tween" that snaps the sprite through the attack arc,
 * using the same half-angle the wedge telegraph is drawn with. */
export function swingSweepAngle(baseAngle: number, halfAngleRad: number, progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return baseAngle + (clamped - 0.5) * 2 * halfAngleRad;
}
