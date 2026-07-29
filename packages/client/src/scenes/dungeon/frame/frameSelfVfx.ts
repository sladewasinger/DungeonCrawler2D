import type { FrameSyncContext } from "./frameSync.js";

export function syncSelfVfx(context: FrameSyncContext): void {
  const { conn, entityRenderer, vfx, state, render, nowMs } = context;
  if (!conn.body) return;
  const groundHeight = conn.world?.groundAt(render.x, render.y) ?? 0;
  const faceX = entityRenderer.playerFacingSign(state.selfPose.id) ??
    state.cosmetics.spriteFaceX;
  vfx.trackPlayerMotion({
    x: render.x,
    y: render.y,
    groundHeight,
    air: !conn.body.grounded,
    faceX: state.cosmetics.faceX,
    nowMs,
  });
  vfx.graceRing.sync({
    x: render.x,
    y: render.y,
    graceUntilMs: state.cosmetics.graceUntilMs,
    nowMs,
  });
  vfx.syncOutOfBreath({
    x: render.x,
    y: render.y,
    z: render.z,
    faceX,
    exhausted: conn.staminaExhausted,
    nowMs,
  });
  vfx.update(nowMs);
}
