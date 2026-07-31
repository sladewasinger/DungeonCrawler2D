/** Maps network snapshots and local prediction into renderer entity view models. */
import { TICK_RATE } from "@dc2d/engine";
import type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";
import type {
  ItemEntityView,
  MonsterEntityView,
  PetEntityView,
  PlayerEntityView,
  RenderContext,
} from "../../../render/entities/geometry/index.js";
import { groundItemFrame } from "./itemFrame.js";
import { remotePlayerFieldsInto } from "./remotePlayerFields.js";
import { isSelfAttacking } from "../player/selfCosmetics.js";
import type { ItemViewSource, RenderContextSource, SelfPlayerViewSource } from "./viewTypes.js";
export type { SelfPose, SelfVitals, ItemViewSource, RenderContextSource, SelfPlayerViewSource } from "./viewTypes.js";
export { projectileView, torchView } from "../projectiles/projectileViews.js";

export type { InterpolatedEntity } from "../../../net/interpolation/interpolate.js";

const EMPTY_FX: readonly string[] = [];

function valueOr<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function buildRenderContext(source: RenderContextSource): RenderContext {
  const { world, nowMs, dtSeconds, selfX, selfY, partyIds, target } = source;
  const context = target ?? {} as RenderContext;
  context.world = world;
  context.nowMs = nowMs;
  context.dtSeconds = dtSeconds;
  context.selfX = selfX;
  context.selfY = selfY;
  context.partyIds = partyIds;
  return context;
}

export function selfPlayerView(source: SelfPlayerViewSource): PlayerEntityView {
  const { pose, vitals, cosmetics, nowMs, weaponAimAngle, assistedAim, target } = source;
  const view = target ?? {} as PlayerEntityView;
  view.id = pose.id; view.playerId = pose.id;
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
  view.admin = vitals.admin ?? false;
  view.downed = vitals.downed;
  view.reviveProgress = vitals.reviveProgress ?? 0;
  view.disconnected = false;
  view.attacking = isSelfAttacking(cosmetics, nowMs);
  view.blocking = vitals.blocking;
  view.weaponId = vitals.weaponId;
  if (vitals.blockFeedback === null || vitals.blockFeedback === undefined) {
    delete view.blockFeedback;
  } else {
    view.blockFeedback = vitals.blockFeedback;
  }
  view.weaponAimAngle = weaponAimAngle;
  view.assistedAim = assistedAim;
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

export function petView(
  e: InterpolatedEntity,
  target?: PetEntityView,
): PetEntityView {
  const view = target ?? {} as PetEntityView;
  view.id = e.id;
  view.defId = valueOr(e.snap.defId, "pet-dog");
  view.name = valueOr(e.snap.name, "Pet");
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  view.anim = e.snap.anim === "walk" ? "walk" : "idle";
  view.petBehavior = e.snap.petBehavior ?? "idle";
  view.petBehaviorEvent = e.snap.petBehaviorEvent ?? 0;
  view.faceX = valueOr(e.snap.faceX, 1);
  view.faceY = valueOr(e.snap.faceY, 0);
  view.air = valueOr(e.snap.air, false);
  if (e.snap.petOwnerName === undefined) delete view.ownerName;
  else view.ownerName = e.snap.petOwnerName;
  return view;
}

export function itemView(source: ItemViewSource): ItemEntityView {
  const { e, target, context } = source;
  const view = target ?? {} as ItemEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  view.frame = groundItemFrame(e.snap.defId);
  if (!isPlayerLootChest(e)) {
    clearLootView(view);
    return view;
  }
  {
    view.lootLabel = `[DEAD] ${e.snap.lootOwnerName}'s loot`;
    if (e.snap.lootKillerName === undefined) delete view.lootKillerName;
    else view.lootKillerName = e.snap.lootKillerName;
    view.lootLockSeconds = Math.ceil(Math.max(
      0,
      (e.snap.lootUnlockAtTick ?? 0) - (context?.serverTick ?? 0),
    ) / TICK_RATE);
    view.lootNearby = !!context &&
      Math.hypot(e.x - context.selfX, e.y - context.selfY) <= 3.5;
  }
  return view;
}

function isPlayerLootChest(e: InterpolatedEntity): boolean {
  return e.snap.defId === "player-loot-chest" && e.snap.lootOwnerName !== undefined;
}

function clearLootView(view: ItemEntityView): void {
  delete view.lootLabel; delete view.lootKillerName;
  delete view.lootLockSeconds; delete view.lootNearby;
}
