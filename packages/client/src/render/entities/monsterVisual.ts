// Monster body visual: server-anim-driven sprite (idle/walk/windup/attack/recover),
// a readable windup/strike telegraph pulse, status tint flicker, hit flash, plus the
// shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../boot/assetManifest.js";
import { resolveAnimState, telegraphScale, telegraphTint } from "./animState.js";
import { depthForEntity } from "./depthSort.js";
import { createHpBar, updateHpBar } from "./hpBar.js";
import { flashIntensity, tookDamage } from "./hitFlash.js";
import { spriteLiftPx } from "./lift.js";
import { createNameplate, updateNameplate } from "./nameplate.js";
import { createShadow, updateShadowPosition } from "./shadow.js";
import type { MonsterVisual } from "./state.js";
import { compositeStatusTint, statusTintFor } from "./statusTint.js";
import type { MonsterEntityView, RenderContext } from "./view.js";
import { worldToScreen } from "./worldToScreen.js";

export function createMonsterVisual(scene: Phaser.Scene, spritePrefix: string): MonsterVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  return {
    kind: "enemy",
    body,
    shadow: createShadow(scene, 0),
    hpBar: createHpBar(scene, 0),
    nameplate: createNameplate(scene, 0),
    spritePrefix,
    lastHp: 0,
    lastFx: [],
    hitFlashStartMs: undefined,
    lastAnim: undefined,
    telegraphStartMs: undefined,
  };
}

/** Body pose: position, depth, animation, telegraph pulse, status/hit tint. */
function updateMonsterBody(visual: MonsterVisual, view: MonsterEntityView, ctx: RenderContext, groundHeight: number): void {
  const screen = worldToScreen(view.x, view.y);
  const liftPx = spriteLiftPx(view.z, groundHeight, view.air);
  visual.body.setPosition(screen.x, screen.y - liftPx);
  visual.body.setDepth(depthForEntity(view.y, view.air ? Math.max(0, view.z - groundHeight) : 0));
  visual.body.setFlipX(view.faceX < 0);

  if (view.anim !== visual.lastAnim) {
    visual.lastAnim = view.anim;
    if (view.anim === "windup" || view.anim === "spit" || view.anim === "attack") visual.telegraphStartMs = ctx.nowMs;
  }
  if (visual.hitFlashStartMs === undefined && tookDamage(visual.lastHp, view.hp)) visual.hitFlashStartMs = ctx.nowMs;

  const resolved = resolveAnimState(visual.spritePrefix, view.anim);
  if (visual.body.anims.currentAnim?.key !== resolved.animKey) visual.body.play(resolved.animKey);
  applyMonsterPresentation(visual, resolved.telegraph, ctx);
}

function applyMonsterPresentation(visual: MonsterVisual, telegraph: ReturnType<typeof resolveAnimState>["telegraph"], ctx: RenderContext): void {
  const telegraphElapsed = ctx.nowMs - (visual.telegraphStartMs ?? ctx.nowMs);
  visual.body.setScale(WORLD_PIXEL_SCALE * telegraphScale(telegraph, telegraphElapsed));

  const flashElapsed = visual.hitFlashStartMs === undefined ? Infinity : ctx.nowMs - visual.hitFlashStartMs;
  if (flashIntensity(flashElapsed) > 0) {
    visual.body.setTintFill(0xffffff);
    return;
  }
  if (flashElapsed >= 0) visual.hitFlashStartMs = undefined;

  const glow = telegraphTint(telegraph);
  const status = statusTintFor(visual.lastFx, ctx.nowMs);
  if (glow !== null) visual.body.setTint(glow);
  else if (status) visual.body.setTint(compositeStatusTint(status));
  else visual.body.clearTint();
}

/** Shadow, hp bar, nameplate — everything that hangs off the body's screen position. */
function updateMonsterChrome(visual: MonsterVisual, view: MonsterEntityView, ctx: RenderContext): void {
  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition(visual.shadow, ground.x, ground.y);
  const headY = ground.y - visual.body.displayHeight;
  updateHpBar(visual.hpBar, ground.x, headY, view.hp, view.maxHp);
  const distance = Math.hypot(view.x - ctx.selfX, view.y - ctx.selfY);
  updateNameplate(visual.nameplate, view.name, ground.x, headY, distance, false);
}

/** Advances one monster's full visual for a fresh snapshot sample. */
export function updateMonsterVisual(visual: MonsterVisual, view: MonsterEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  visual.lastFx = view.fx;
  updateMonsterBody(visual, view, ctx, groundHeight);
  updateMonsterChrome(visual, view, ctx);
  visual.lastHp = view.hp;
}
