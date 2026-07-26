/** Maps network snapshots and local prediction into renderer entity view models. */
import { TICK_RATE, type WorldView } from "@dc2d/engine";
import type { InterpolatedEntity } from "../../net/interpolate.js";
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
import { remotePlayerFieldsInto } from "./remotePlayerFields.js";
import { isSelfAttacking, type SelfCosmeticsState } from "./selfCosmetics.js";

export type { InterpolatedEntity } from "../../net/interpolate.js";

const EMPTY_FX: readonly string[] = [];

function valueOr<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function buildRenderContext(
  world: WorldView,
  nowMs: number,
  dtSeconds: number,
  selfX: number,
  selfY: number,
  partyIds: ReadonlySet<string>,
  target?: RenderContext,
): RenderContext {
  const context = target ?? {} as RenderContext;
  context.world = world;
  context.nowMs = nowMs;
  context.dtSeconds = dtSeconds;
  context.selfX = selfX;
  context.selfY = selfY;
  context.partyIds = partyIds;
  return context;
}

export interface SelfPose {
  id: string;
  skin: import("@dc2d/engine").PlayerSkin;
  name: string;
  x: number;
  y: number;
  z: number;
  air: boolean;
}

export interface SelfVitals {
  hp: number;
  maxHp: number;
  fx: readonly string[];
  downed: boolean;
  blocking: boolean;
  weaponId: string | null;
}

export function selfPlayerView(
  pose: SelfPose,
  vitals: SelfVitals,
  cosmetics: SelfCosmeticsState,
  nowMs: number,
  weaponAimAngle: number,
  target?: PlayerEntityView,
): PlayerEntityView {
  const view = target ?? {} as PlayerEntityView;
  view.id = pose.id;
  view.playerId = pose.id;
  view.skin = pose.skin;
  view.name = pose.name;
  view.x = pose.x;
  view.y = pose.y;
  view.z = pose.z;
  view.hp = vitals.hp;
  view.maxHp = vitals.maxHp;
  view.fx = vitals.fx;
  view.faceX = cosmetics.spriteFaceX;
  view.faceY = cosmetics.faceY;
  view.air = pose.air;
  view.downed = vitals.downed;
  view.disconnected = false;
  view.attacking = isSelfAttacking(cosmetics, nowMs);
  view.blocking = vitals.blocking;
  view.weaponId = vitals.weaponId;
  view.weaponAimAngle = weaponAimAngle;
  view.attackAngleRad = Math.atan2(cosmetics.attackDirY, cosmetics.attackDirX);
  return view;
}

/** Other players use replicated equipment, facing, and reconnect status. */
export function remotePlayerView(
  e: InterpolatedEntity,
  target?: PlayerEntityView,
): PlayerEntityView {
  const view = target ?? {} as PlayerEntityView;
  view.id = e.id;
  view.playerId = e.id;
  if (e.snap.skin === undefined) delete view.skin;
  else view.skin = e.snap.skin;
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  remotePlayerFieldsInto(e.snap, view);
  return view;
}

export function monsterView(
  e: InterpolatedEntity,
  target?: MonsterEntityView,
): MonsterEntityView {
  const view = target ?? {} as MonsterEntityView;
  view.id = e.id;
  view.defId = valueOr(e.snap.defId, "unknown");
  view.name = valueOr(e.snap.name, valueOr(e.snap.defId, "?"));
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  view.hp = valueOr(e.snap.hp, 0);
  view.maxHp = valueOr(e.snap.maxHp, 1);
  view.fx = valueOr(e.snap.fx, EMPTY_FX);
  view.anim = valueOr(e.snap.anim, "idle");
  view.faceX = valueOr(e.snap.faceX, 1);
  view.air = valueOr(e.snap.air, false);
  return view;
}

export function itemView(
  e: InterpolatedEntity,
  target?: ItemEntityView,
  context?: { serverTick: number; selfX: number; selfY: number },
): ItemEntityView {
  const view = target ?? {} as ItemEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.frame = groundItemFrame(e.snap.defId);
  if (e.snap.defId === "player-loot-chest" && e.snap.lootOwnerName) {
    view.lootLabel = `[DEAD] ${e.snap.lootOwnerName}'s loot`;
    if (e.snap.lootKillerName === undefined) delete view.lootKillerName;
    else view.lootKillerName = e.snap.lootKillerName;
    view.lootLockSeconds = Math.ceil(Math.max(
      0,
      (e.snap.lootUnlockAtTick ?? 0) - (context?.serverTick ?? 0),
    ) / TICK_RATE);
    view.lootNearby = !!context &&
      Math.hypot(e.x - context.selfX, e.y - context.selfY) <= 3.5;
  } else {
    delete view.lootLabel;
    delete view.lootKillerName;
    delete view.lootLockSeconds;
    delete view.lootNearby;
  }
  return view;
}

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
