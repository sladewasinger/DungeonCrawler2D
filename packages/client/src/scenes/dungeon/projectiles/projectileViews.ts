import type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";
import type { ProjectileEntityView, TorchEntityView } from "../../../render/entities/geometry/index.js";
import { groundItemFrame } from "../entities/itemFrame.js";
import { trackProjectileVelocity, type ProjectileVelocityState } from "../player/projectileVelocity.js";

export interface ProjectileViewInput {
  readonly e: InterpolatedEntity;
  readonly velocity: ProjectileVelocityState;
  readonly nowMs: number;
  readonly target?: ProjectileEntityView | undefined;
}

export function projectileView(input: ProjectileViewInput): ProjectileEntityView {
  const { e, velocity, nowMs, target } = input;
  const { vx, vy } = trackProjectileVelocity(velocity, { id: e.id, x: e.x, y: e.y, nowMs });
  const view = target ?? {} as ProjectileEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
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
