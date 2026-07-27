// Player body visual: feet-anchored hero sprite, held weapon following facing, hit
// flash, downed pose, plus the shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { getViewOrientation } from "../view/viewState.js";
import { viewTileToWorld, worldAngleToView, worldToView } from "../view/viewTransform.js";
import { resolveAnimState } from "./animState.js";
import { createHeldWeapon, updateHeldWeapon } from "./heldWeapon.js";
import { createHpBar, updateHpBar } from "./hpBar.js";
import { resolveHpBarVisibility } from "./hpBarVisibility.js";
import { flashIntensity, tookDamage } from "./hitFlash.js";
import { airborneHeightAboveGround, spriteLiftPx } from "./lift.js";
import { createNameplate, updateNameplate } from "./nameplate.js";
import { syncOcclusionSilhouette, terrainOcclusionAhead } from "./occlusion.js";
import { inferPlayerAnimState, isRunningPace } from "./playerMotion.js";
import { createShadow, updateShadowPosition } from "./shadow.js";
import { squashScale } from "./squash.js";
import type { PlayerVisual } from "./state.js";
import type { PlayerEntityView, RenderContext } from "./view.js";
import { FIST_FALLBACK_FRAME, weaponIconFrame } from "./weaponIcon.js";
import { stepOrbitAngle } from "./weaponOrbit.js";
import { depthForEntityNow, worldToScreen } from "./worldToScreen.js";
import { updateGuardCone } from "./guardCone.js";
import { updatePlayerReviveRing } from "./player/playerReviveRing.js";

const DOWNED_TINT = 0x7a3d3d;
const DISCONNECTED_TINT = 0x55555a;
const DOWNED_ANGLE = 78;
const STRIKE_DURATION_MS = 160;
/** Epic 7.12: no dedicated run frames exist, so running plays the same walk loop
 * faster instead — see playerMotion.ts's isRunningPace doc comment. */
const RUN_ANIM_TIMESCALE = 1.35;

export function createPlayerVisual(scene: Phaser.Scene, nowMs: number): PlayerVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  return {
    kind: "player",
    body,
    weapon: createHeldWeapon(scene, 0),
    guardCone: scene.add.graphics(),
    reviveRing: scene.add.graphics(),
    shadow: createShadow(scene, 0),
    hpBar: createHpBar(scene, 0),
    nameplate: createNameplate(scene, 0),
    lastHp: undefined,
    hpBarRevealed: false,
    hitFlashStartMs: undefined,
    lastX: 0,
    lastY: 0,
    lastSampleMs: nowMs,
    lastAir: false,
    squashStartMs: undefined,
    weaponAngle: 0,
    wasAttacking: false,
    swingStartMs: undefined,
  };
}

/** Body pose: position, feet-anchored depth, animation, hit-flash/downed tint. */
function updatePlayerBody(
  visual: PlayerVisual,
  skinPrefix: string,
  view: PlayerEntityView,
  ctx: RenderContext,
  heightAboveGround: number,
): void {
  const screen = worldToScreen(view.x, view.y);
  // ELEVATION-PROJECTION section 3: absolute-z lift. Terrain now bakes the matching
  // shift into its own drawn cap (wave E2), so a grounded body (z === groundAt) lands
  // exactly on it — see lift.ts's module doc.
  visual.body.setPosition(screen.x, screen.y - spriteLiftPx(view.z));
  visual.body.setDepth(depthForEntityNow(view.x, view.y, heightAboveGround));
  updatePlayerReviveRing(visual.reviveRing, visual.body, view);
  visual.body.setFlipX(playerFacesLeft(visual, view));

  if (visual.hitFlashStartMs === undefined && tookDamage(visual.lastHp, view.hp)) visual.hitFlashStartMs = ctx.nowMs;
  applyLandingSquash(visual, view.air, ctx.nowMs);

  const dt = (ctx.nowMs - visual.lastSampleMs) / 1000;
  const dxTiles = view.x - visual.lastX;
  const dyTiles = view.y - visual.lastY;
  const anim = inferPlayerAnimState(dxTiles, dyTiles, dt, view.attacking);
  const resolved = resolveAnimState(skinPrefix, view.downed ? "idle" : anim);
  if (visual.body.anims.currentAnim?.key !== resolved.animKey) visual.body.play(resolved.animKey);
  const running = anim === "walk" && isRunningPace(dxTiles, dyTiles, dt);
  visual.body.anims.timeScale = running ? RUN_ANIM_TIMESCALE : 1;

  applyPlayerTint(visual, view, ctx);
  visual.body.setAngle(view.downed ? DOWNED_ANGLE : 0);
}

/** Landing-squash edge trigger + scale application, split out of updatePlayerBody to keep its complexity down. */
function applyLandingSquash(visual: PlayerVisual, airborne: boolean, nowMs: number): void {
  if (visual.lastAir && !airborne) visual.squashStartMs = nowMs;
  visual.lastAir = airborne;
  const squash = squashScale(visual.squashStartMs === undefined ? Infinity : nowMs - visual.squashStartMs);
  visual.body.setScale(WORLD_PIXEL_SCALE * squash.scaleX, WORLD_PIXEL_SCALE * squash.scaleY);
}

function applyPlayerTint(visual: PlayerVisual, view: PlayerEntityView, ctx: RenderContext): void {
  if (view.disconnected) {
    visual.body.setTint(DISCONNECTED_TINT);
    return;
  }
  if (view.downed) {
    visual.body.setTint(DOWNED_TINT);
    return;
  }
  const elapsed = visual.hitFlashStartMs === undefined ? Infinity : ctx.nowMs - visual.hitFlashStartMs;
  if (flashIntensity(elapsed) > 0) {
    setTintFill(visual.body, 0xffffff);
  } else {
    visual.body.clearTint();
    if (elapsed >= 0) visual.hitFlashStartMs = undefined;
  }
}

function setTintFill(sprite: Phaser.GameObjects.Sprite, color: number): void {
  sprite.setTint(color);
  (sprite as unknown as { setTintMode?: (mode: number) => void }).setTintMode?.(1);
}

/** Shadow, hp bar, nameplate, held weapon, and occlusion silhouette — everything that
 * hangs off the body's screen position. Shadow is GROUND-anchored (section 5): fed the
 * SHIFTED ground screen point (`worldToScreen(...).y - groundAt*TILE`, reusing
 * spriteLiftPx's identical `height*TILE` shape), which coincides with the sprite's own
 * absolute-z lift once grounded — both land on the same drawn cap. Nameplate/hp bar
 * are ENTITY-anchored: they just follow the already-lifted body position. */
function updatePlayerChrome(
  visual: PlayerVisual,
  view: PlayerEntityView,
  ctx: RenderContext,
  heightAboveGround: number,
  groundHeight: number,
): void {
  const ground = worldToScreen(view.x, view.y);
  const shiftedGroundY = ground.y - spriteLiftPx(groundHeight);
  const bodyDepth = visual.body.depth;
  visual.shadow.setDepth(bodyDepth - 0.2);
  visual.hpBar.container.setDepth(bodyDepth + 0.2);
  visual.nameplate.setDepth(bodyDepth + 0.2);
  updateShadowPosition(visual.shadow, ground.x, shiftedGroundY, heightAboveGround);
  const headY = visual.body.y - visual.body.displayHeight;
  updateHpBar(visual.hpBar, visual.body.x, headY, view.hp, view.maxHp);
  visual.hpBarRevealed = resolveHpBarVisibility(
    visual.lastHp,
    view.hp,
    view.maxHp,
    visual.hpBarRevealed,
  );
  visual.hpBar.container.setVisible(visual.hpBarRevealed);

  const distance = Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY);
  updateNameplate(visual.nameplate, view.name, visual.body.x, headY, distance, ctx.partyIds.has(view.id), view.downed, view.disconnected);

  const occlusion = terrainOcclusionAhead(ctx.world, view.x, view.y, view.z, getViewOrientation());
  syncOcclusionSilhouette(visual.body, view.y, occlusion);
  updateWeaponVisual(visual, view, ctx);
}

/** Edge-triggers the strike-sweep clock when `attacking` flips false->true (mirrors hitFlash.ts's tookDamage edge). */
function applySwingEdge(visual: PlayerVisual, attacking: boolean, nowMs: number): void {
  if (attacking && !visual.wasAttacking) visual.swingStartMs = nowMs;
  visual.wasAttacking = attacking;
}

/** 0..1 progress through STRIKE_DURATION_MS since this swing's edge-triggered start; 0 when not striking. */
function strikeProgress(visual: PlayerVisual, attacking: boolean, nowMs: number): number {
  if (!attacking || visual.swingStartMs === undefined) return 0;
  return Math.min(1, (nowMs - visual.swingStartMs) / STRIKE_DURATION_MS);
}

/** Weapon sprite: local aim or replicated remote facing drives the same orbit. */
function isGuarding(view: PlayerEntityView): boolean {
  return !view.downed && view.blocking;
}

function playerFacesLeft(
  visual: PlayerVisual,
  view: PlayerEntityView,
): boolean {
  if (view.weaponId === null || view.weaponAimAngle === null) {
    return view.faceX < 0;
  }
  return Math.cos(visual.weaponAngle) < 0;
}

function isStriking(view: PlayerEntityView): boolean {
  return !view.downed && !view.blocking && view.attacking;
}

function updateWeaponVisual(visual: PlayerVisual, view: PlayerEntityView, ctx: RenderContext): void {
  const blocking = isGuarding(view);
  const striking = isStriking(view);
  applySwingEdge(visual, striking, ctx.nowMs);
  const aimAngle = view.weaponAimAngle;
  const isSelf = aimAngle !== null;
  const facingAngle = worldAngleToView(Math.atan2(view.faceY, view.faceX), getViewOrientation());
  const guardAngle = isSelf ? visual.weaponAngle : facingAngle;
  updateGuardCone(visual, blocking, guardAngle);

  const rawFrame = view.downed ? null : weaponIconFrame(view.weaponId);
  const isFistFallback = rawFrame === null && !view.downed;
  updateHeldWeapon(visual.weapon, rawFrame ?? (isFistFallback ? FIST_FALLBACK_FRAME : null), {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    blocking,
    nowMs: ctx.nowMs,
    strikeProgress: strikeProgress(visual, striking, ctx.nowMs),
    wielderDepth: visual.body.depth,
    wielderViewY: worldToView({ x: view.x, y: view.y }, getViewOrientation()).y,
    screenSouthFloorHigher: screenSouthFloorHigher(view, ctx),
    orbitAngleRad: isSelf ? visual.weaponAngle : facingAngle,
    attackAngleRad: worldAngleToView(view.attackAngleRad, getViewOrientation()),
    isFistFallback,
  });
}

function screenSouthFloorHigher(view: PlayerEntityView, ctx: RenderContext): boolean {
  const orientation = getViewOrientation();
  const viewPosition = worldToView({ x: view.x, y: view.y }, orientation);
  const southWorld = viewTileToWorld({ x: Math.floor(viewPosition.x), y: Math.floor(viewPosition.y) + 1 }, orientation);
  return ctx.world.isWalkable(southWorld.x, southWorld.y) &&
    ctx.world.heightAt(southWorld.x, southWorld.y) > view.z + 0.01;
}

/** Advances one player's full visual for a fresh snapshot sample. */
export function updatePlayerVisual(visual: PlayerVisual, skinPrefix: string, view: PlayerEntityView, ctx: RenderContext): void {
  if (view.weaponAimAngle !== null) {
    visual.weaponAngle = stepOrbitAngle(
      visual.weaponAngle,
      view.weaponAimAngle,
      ctx.dtSeconds,
    );
  }
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  updatePlayerBody(visual, skinPrefix, view, ctx, heightAboveGround);
  updatePlayerChrome(visual, view, ctx, heightAboveGround, groundHeight);
  visual.lastHp = view.hp;
  visual.lastX = view.x;
  visual.lastY = view.y;
  visual.lastSampleMs = ctx.nowMs;
}
