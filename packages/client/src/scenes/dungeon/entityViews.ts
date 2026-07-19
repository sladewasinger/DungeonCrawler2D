// Maps net/ wire state onto the render/entities view-models: one function per entity
// kind, plus the self player (whose pose/facing/attack cosmetics come from local
// prediction + selfCosmetics.ts rather than a snapshot, since the server never sends
// self an entity record for itself).
import type { EntitySnapshot, WorldView } from "@dc2d/engine";
import type {
  ItemEntityView,
  MonsterEntityView,
  PlayerEntityView,
  ProjectileEntityView,
  RenderContext,
} from "../../render/entities/index.js";
import { groundItemFrame } from "./itemFrame.js";
import { trackProjectileVelocity, type ProjectileVelocityState } from "./projectileVelocity.js";
import { isSelfAttacking, type SelfCosmeticsState } from "./selfCosmetics.js";

/** One net/interpolate.ts sample: a remote entity's id/snapshot plus its smoothed pose. */
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
  /** Live weapon-orbit target (radians): mouse-relative on desktop, facing-locked on touch — resolved by the scene from real input (weaponOrbit.ts), since input isn't otherwise visible to this module. */
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
    attacking: isSelfAttacking(cosmetics, nowMs),
    weaponId: vitals.weaponId,
    weaponAimAngle,
    attackAngleRad: Math.atan2(cosmetics.attackDirY, cosmetics.attackDirX),
  };
}

/** Other players: weaponId stays null — the protocol only reports self's equipped weapon (see render/entities/view.ts). */
export function remotePlayerView(e: InterpolatedEntity): PlayerEntityView {
  const faceX = e.snap.faceX ?? 1;
  const faceY = e.snap.faceY ?? 0;
  return {
    id: e.id,
    playerId: e.id,
    name: e.snap.name ?? "?",
    x: e.x,
    y: e.y,
    z: e.z,
    hp: e.snap.hp ?? 0,
    maxHp: e.snap.maxHp ?? 1,
    fx: e.snap.fx ?? [],
    faceX,
    faceY,
    air: e.snap.air ?? false,
    downed: e.snap.downed ?? false,
    attacking: e.snap.anim === "attack",
    weaponId: null,
    weaponAimAngle: null,
    // The protocol never reports a remote player's actual swing direction (only enemies
    // get aimX/aimY — see game-server/sim/snapshots.ts's enemyAnimFields), so their
    // reported facing is the wedge telegraph's best available proxy for "attack direction".
    attackAngleRad: Math.atan2(faceY, faceX),
  };
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
