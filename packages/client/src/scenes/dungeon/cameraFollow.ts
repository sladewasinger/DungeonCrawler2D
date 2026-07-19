// Eased camera math: glides toward the render target every frame, but snaps instantly
// once (teleport, reconnect, respawn) when requested — per VISUAL_DIRECTION's "camera
// eases; snaps only on teleport". Pure state + step function, no Phaser dependency.

export interface CameraFollowState {
  x: number;
  y: number;
  /** Consumed on the next step: forces an instant jump instead of an ease. */
  snap: boolean;
}

export function createCameraFollowState(): CameraFollowState {
  return { x: 0, y: 0, snap: true };
}

/** Arranges for the next stepCameraFollow call to jump straight to its target. */
export function requestCameraSnap(state: CameraFollowState): void {
  state.snap = true;
}

/** Exponential-decay ease rate (matches reference/client's proven feel). */
const EASE_RATE_PER_SEC = 10;

/** Advances the eased camera position one frame toward (targetX, targetY). */
export function stepCameraFollow(
  state: CameraFollowState,
  targetX: number,
  targetY: number,
  deltaMs: number,
): void {
  if (state.snap) {
    state.x = targetX;
    state.y = targetY;
    state.snap = false;
    return;
  }
  const k = 1 - Math.exp((-deltaMs / 1000) * EASE_RATE_PER_SEC);
  state.x += (targetX - state.x) * k;
  state.y += (targetY - state.y) * k;
}
