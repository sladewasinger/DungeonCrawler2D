// Player body visual: feet-anchored hero sprite, held weapon following facing, hit
// flash, downed pose, plus the shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { resolveAnimState } from "./animState.js";
import { depthForEntity } from "./depthSort.js";
import { createHeldWeapon, updateHeldWeapon } from "./heldWeapon.js";
import { createHpBar, updateHpBar } from "./hpBar.js";
import { flashIntensity, tookDamage } from "./hitFlash.js";
import { spriteLiftPx } from "./lift.js";
import { createNameplate, updateNameplate } from "./nameplate.js";
import { inferPlayerAnimState } from "./playerMotion.js";
import { createShadow, updateShadowPosition } from "./shadow.js";
import type { PlayerVisual } from "./state.js";
import type { PlayerEntityView, RenderContext } from "./view.js";
import { weaponIconFrame } from "./weaponIcon.js";
import { worldToScreen } from "./worldToScreen.js";

const DOWNED_TINT = 0x7a3d3d;
const DOWNED_ANGLE = 78;
const STRIKE_DURATION_MS = 160;

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
  };
}

/** Body pose: position, feet-anchored depth, animation, hit-flash/downed tint. */
function updatePlayerBody(
  visual: PlayerVisual,
  skinPrefix: string,
  view: PlayerEntityView,
  ctx: RenderContext,
  groundHeight: number,
): void {
  const screen = worldToScreen(view.x, view.y);
  const liftPx = spriteLiftPx(view.z, groundHeight, view.air);
  visual.body.setPosition(screen.x, screen.y - liftPx);
  visual.body.setDepth(depthForEntity(view.y, view.air ? Math.max(0, view.z - groundHeight) : 0));
  visual.body.setFlipX(view.faceX < 0);

  if (visual.hitFlashStartMs === undefined && tookDamage(visual.lastHp, view.hp)) visual.hitFlashStartMs = ctx.nowMs;

  const dt = (ctx.nowMs - visual.lastSampleMs) / 1000;
  const anim = inferPlayerAnimState(view.x - visual.lastX, view.y - visual.lastY, dt, view.attacking);
  const resolved = resolveAnimState(skinPrefix, view.downed ? "idle" : anim);
  if (visual.body.anims.currentAnim?.key !== resolved.animKey) visual.body.play(resolved.animKey);

  applyPlayerTint(visual, view, ctx);
  visual.body.setAngle(view.downed ? DOWNED_ANGLE : 0);
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

/** Shadow, hp bar, nameplate, and held weapon — everything that hangs off the body's screen position. */
function updatePlayerChrome(visual: PlayerVisual, view: PlayerEntityView, ctx: RenderContext): void {
  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition(visual.shadow, ground.x, ground.y);
  updateHpBar(visual.hpBar, ground.x, ground.y - visual.body.displayHeight, view.hp, view.maxHp);

  const distance = Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY);
  updateNameplate(visual.nameplate, view.name, ground.x, ground.y - visual.body.displayHeight, distance, ctx.partyIds.has(view.id));

  const striking = !view.downed && view.attacking;
  updateHeldWeapon(visual.weapon, view.downed ? null : weaponIconFrame(view.weaponId), {
    screenX: visual.body.x,
    screenY: visual.body.y,
    facingX: view.faceX,
    striking,
    strikeProgress: striking ? Math.min(1, (ctx.nowMs % STRIKE_DURATION_MS) / STRIKE_DURATION_MS) : 0,
    wielderDepth: visual.body.depth,
  });
}

/** Advances one player's full visual for a fresh snapshot sample. */
export function updatePlayerVisual(visual: PlayerVisual, skinPrefix: string, view: PlayerEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  updatePlayerBody(visual, skinPrefix, view, ctx, groundHeight);
  updatePlayerChrome(visual, view, ctx);
  visual.lastHp = view.hp;
  visual.lastX = view.x;
  visual.lastY = view.y;
  visual.lastSampleMs = ctx.nowMs;
}
