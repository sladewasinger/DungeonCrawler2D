import type { InterpolatedEntity } from "../../../net/interpolate.js";
import type { ProjectileEntityView, TorchEntityView } from "../../../render/entities/index.js";
import { groundItemFrame } from "../itemFrame.js";
import { trackProjectileVelocity, type ProjectileVelocityState } from "../projectileVelocity.js";

export function projectileView(
  e: InterpolatedEntity,
  velocity: ProjectileVelocityState,
  nowMs: number,
  target?: ProjectileEntityView,
): ProjectileEntityView {
  const { vx, vy } = trackProjectileVelocity(velocity, e.id, e.x, e.y, nowMs);
  const view = target ?? {} as ProjectileEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.frame = groundItemFrame(e.snap.defId);
  view.vx = vx;
  view.vy = vy;
  return view;
}

/** Torch snapshots carry state server-side; flying is only a stale-sample fallback. */
export function torchView(
  e: InterpolatedEntity,
  target?: TorchEntityView,
): TorchEntityView {
  const view = target ?? {} as TorchEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  view.air = e.snap.air ?? false;
  view.state = e.snap.state ?? "flying";
  view.frame = groundItemFrame(e.snap.defId);
  view.vx = e.snap.vx ?? 0;
  view.vy = e.snap.vy ?? 0;
  return view;
}
