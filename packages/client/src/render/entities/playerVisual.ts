// Player body visual: feet-anchored hero sprite, held weapon following facing, hit
// flash, downed pose, plus the shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { getViewOrientation } from "../view/viewState.js";
import { worldAngleToView } from "../view/viewTransform.js";
import { resolveAnimState } from "./animState.js";
import { createHeldWeapon, updateHeldWeapon } from "./heldWeapon.js";
import { createHpBar, updateHpBar } from "./hpBar.js";
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

const DOWNED_TINT = 0x7a3d3d;
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
    shadow: createShadow(scene, 0),
    hpBar: createHpBar(scene, 0),
    nameplate: createNameplate(scene, 0),
    lastHp: 0,
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
  visual.body.setFlipX(view.faceX < 0);

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
  if (view.downed) {
    visual.body.setTint(DOWNED_TINT);
    return;
  }
  const elapsed = visual.hitFlashStartMs === undefined ? Infinity : ctx.nowMs - visual.hitFlashStartMs;
  if (flashIntensity(elapsed) > 0) {
    visual.body.setTintFill(0xffffff);
  } else {
    visual.body.clearTint();
    if (elapsed >= 0) visual.hitFlashStartMs = undefined;
  }
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

  const distance = Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY);
  updateNameplate(visual.nameplate, view.name, visual.body.x, headY, distance, ctx.partyIds.has(view.id), view.downed);

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
function updateWeaponVisual(visual: PlayerVisual, view: PlayerEntityView, ctx: RenderContext): void {
  const striking = !view.downed && view.attacking;
  applySwingEdge(visual, striking, ctx.nowMs);
  const aimAngle = view.weaponAimAngle;
  const isSelf = aimAngle !== null;
  if (isSelf) visual.weaponAngle = stepOrbitAngle(visual.weaponAngle, aimAngle, ctx.dtSeconds);
  const facingAngle = worldAngleToView(Math.atan2(view.faceY, view.faceX), getViewOrientation());

  const rawFrame = view.downed ? null : weaponIconFrame(view.weaponId);
  const isFistFallback = isSelf && rawFrame === null && !view.downed;
  updateHeldWeapon(visual.weapon, rawFrame ?? (isFistFallback ? FIST_FALLBACK_FRAME : null), {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    strikeProgress: strikeProgress(visual, striking, ctx.nowMs),
    wielderDepth: visual.body.depth,
    orbitAngleRad: isSelf ? visual.weaponAngle : facingAngle,
    attackAngleRad: worldAngleToView(view.attackAngleRad, getViewOrientation()),
    isFistFallback,
  });
}

/** Advances one player's full visual for a fresh snapshot sample. */
export function updatePlayerVisual(visual: PlayerVisual, skinPrefix: string, view: PlayerEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  updatePlayerBody(visual, skinPrefix, view, ctx, heightAboveGround);
  updatePlayerChrome(visual, view, ctx, heightAboveGround, groundHeight);
  visual.lastHp = view.hp;
  visual.lastX = view.x;
  visual.lastY = view.y;
  visual.lastSampleMs = ctx.nowMs;
}
