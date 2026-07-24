/** Maps network snapshots and local prediction into renderer entity view models. */
import type { EntitySnapshot, WorldView } from "@dc2d/engine";
import type {
  ItemEntityView,
  MonsterEntityView,
  PlayerEntityView,
  ProjectileEntityView,
  RenderContext,
  TorchEntityView,
} from "../../render/entities/index.js";
import { groundItemFrame } from "./itemFrame.js";
import { trackProjectileVelocity, type ProjectileVelocityState } from "./projectileVelocity.js";
import { remotePlayerFields } from "./remotePlayerFields.js";
import { isSelfAttacking, type SelfCosmeticsState } from "./selfCosmetics.js";

/** One interpolated network entity with a smoothed world position. */
export interface InterpolatedEntity {
  readonly id: string;
  readonly snap: EntitySnapshot;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function buildRenderContext(
  world: WorldView,
  nowMs: number,
  dtSeconds: number,
  selfX: number,
  selfY: number,
  partyIds: ReadonlySet<string>,
): RenderContext {
  return { world, nowMs, dtSeconds, selfX, selfY, partyIds };
}

export interface SelfPose {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly air: boolean;
}

export interface SelfVitals {
  readonly hp: number;
  readonly maxHp: number;
  readonly fx: readonly string[];
  readonly downed: boolean;
  readonly weaponId: string | null;
}

export function selfPlayerView(
  pose: SelfPose,
  vitals: SelfVitals,
  cosmetics: SelfCosmeticsState,
  nowMs: number,
  weaponAimAngle: number,
): PlayerEntityView {
  return {
    id: pose.id,
    playerId: pose.id,
    name: pose.name,
    x: pose.x,
    y: pose.y,
    z: pose.z,
    hp: vitals.hp,
    maxHp: vitals.maxHp,
    fx: vitals.fx,
    faceX: cosmetics.faceX,
    faceY: cosmetics.faceY,
    air: pose.air,
    downed: vitals.downed,
    disconnected: false,
    attacking: isSelfAttacking(cosmetics, nowMs),
    weaponId: vitals.weaponId,
    weaponAimAngle,
    attackAngleRad: Math.atan2(cosmetics.attackDirY, cosmetics.attackDirX),
  };
}

/** Other players use replicated equipment, facing, and reconnect status. */
export function remotePlayerView(e: InterpolatedEntity): PlayerEntityView {
  return { id: e.id, playerId: e.id, x: e.x, y: e.y, z: e.z, ...remotePlayerFields(e.snap) };
}

export function monsterView(e: InterpolatedEntity): MonsterEntityView {
  return {
    id: e.id,
    defId: e.snap.defId ?? "unknown",
    name: e.snap.name ?? e.snap.defId ?? "?",
    x: e.x,
    y: e.y,
    z: e.z,
    hp: e.snap.hp ?? 0,
    maxHp: e.snap.maxHp ?? 1,
    fx: e.snap.fx ?? [],
    anim: e.snap.anim ?? "idle",
    faceX: e.snap.faceX ?? 1,
    air: e.snap.air ?? false,
  };
}

export function itemView(e: InterpolatedEntity): ItemEntityView {
  return { id: e.id, x: e.x, y: e.y, frame: groundItemFrame(e.snap.defId) };
}

export function projectileView(
  e: InterpolatedEntity,
  velocity: ProjectileVelocityState,
  nowMs: number,
): ProjectileEntityView {
  const { vx, vy } = trackProjectileVelocity(velocity, e.id, e.x, e.y, nowMs);
  return { id: e.id, x: e.x, y: e.y, frame: groundItemFrame(e.snap.defId), vx, vy };
}

/** Torch snapshots carry state server-side; flying is only a stale-sample fallback. */
export function torchView(e: InterpolatedEntity): TorchEntityView {
  return {
    id: e.id,
    x: e.x,
    y: e.y,
    z: e.z,
    air: e.snap.air ?? false,
    state: e.snap.state ?? "flying",
    frame: groundItemFrame(e.snap.defId),
    vx: e.snap.vx ?? 0,
    vy: e.snap.vy ?? 0,
  };
}
