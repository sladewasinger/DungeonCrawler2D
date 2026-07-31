// Monster body visual: server-anim-driven sprite (idle/walk/windup/attack/recover),
// a readable windup/strike telegraph pulse, status tint flicker, hit flash, plus the
// shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { resolveAnimState, telegraphScale } from "../motion/animState.js";
import { createHpBar, HP_BAR_DISPLAY_HEIGHT_PX, updateHpBar } from "../presentation/hpBar.js";
import { resolveHpBarVisibility } from "../presentation/hpBarVisibility.js";
import { flashIntensity, tookDamage } from "../combat/feedback/hitFlash.js";
import { airborneHeightAboveGround, spriteLiftPx } from "../motion/lift.js";
import { createNameplate, LABEL_LINE_GAP_PX, NAMEPLATE_GAP_PX, NAMEPLATE_LINE_HEIGHT_PX, updateNameplate } from "../presentation/nameplate.js";
import { createShadow, updateShadowPosition } from "../geometry/shadow.js";
import type { MonsterVisual } from "./state.js";
import {
  applyCombatantTint,
  resolveCombatantTint,
  resolveCombatantTintLayer,
} from "../combat/status/statusTint.js";
import type { MonsterEntityView, RenderContext } from "./view.js";
import { depthForEntityNow, worldToScreen } from "../geometry/worldToScreen.js";

export function createMonsterVisual(scene: Phaser.Scene, spritePrefix: string): MonsterVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  return {
    kind: "enemy",
    body,
    shadow: createShadow(scene, 0),
    hpBar: createHpBar(scene, 0),
    nameplate: createNameplate(scene, 0),
    spritePrefix,
    lastHp: undefined,
    hpBarRevealed: false,
    lastFx: [],
    hitFlashStartMs: undefined,
    lastAnim: undefined,
    telegraphStartMs: undefined,
  };
}

/** Body pose: position, depth, animation, telegraph pulse, status/hit tint. */
interface MonsterBodyUpdate {
  readonly visual: MonsterVisual;
  readonly view: MonsterEntityView;
  readonly context: RenderContext;
  readonly heightAboveGround: number;
}

function updateMonsterBody({ visual, view, context, heightAboveGround }: MonsterBodyUpdate): void {
  positionMonsterBody(visual, view, heightAboveGround);
  updateMonsterVisualState(visual, view, context.nowMs);
  applyMonsterAnimation(visual, view, context);
}

function positionMonsterBody(visual: MonsterVisual, view: MonsterEntityView, heightAboveGround: number): void {
  const screen = worldToScreen(view.x, view.y);
  // ELEVATION-PROJECTION section 3: absolute-z lift — see lift.ts's module doc and
  // playerVisual.ts's matching comment.
  visual.body.setPosition(screen.x, screen.y - spriteLiftPx(view.z)); visual.body.setDepth(depthForEntityNow(view.x, view.y, heightAboveGround));
  visual.body.setFlipX(view.faceX < 0);
}

function updateMonsterVisualState(visual: MonsterVisual, view: MonsterEntityView, nowMs: number): void {
  if (view.anim !== visual.lastAnim) {
    visual.lastAnim = view.anim;
    if (startsTelegraph(view.anim)) visual.telegraphStartMs = nowMs;
  }
  if (visual.hitFlashStartMs === undefined && tookDamage(visual.lastHp, view.hp)) visual.hitFlashStartMs = nowMs;
}

function applyMonsterAnimation(visual: MonsterVisual, view: MonsterEntityView, context: RenderContext): void {
  const resolved = resolveAnimState(visual.spritePrefix, view.anim);
  if (visual.body.anims.currentAnim?.key !== resolved.animKey) visual.body.play(resolved.animKey);
  applyMonsterPresentation(visual, resolved.telegraph, context);
}

function startsTelegraph(animation: MonsterEntityView["anim"]): boolean {
  return animation === "windup" || animation === "spit" || animation === "attack";
}

function applyMonsterPresentation(visual: MonsterVisual, telegraph: ReturnType<typeof resolveAnimState>["telegraph"], ctx: RenderContext): void {
  const telegraphElapsed = ctx.nowMs - (visual.telegraphStartMs ?? ctx.nowMs);
  visual.body.setScale(WORLD_PIXEL_SCALE * telegraphScale(telegraph, telegraphElapsed));
  const damageFlashing = monsterDamageFlashing(visual, ctx.nowMs);
  const layer = resolveCombatantTintLayer(damageFlashing, "normal", telegraph !== "none");
  applyCombatantTint(
    visual.body,
    resolveCombatantTint(visual.lastFx, ctx.nowMs, layer),
  );
}

function monsterDamageFlashing(visual: MonsterVisual, nowMs: number): boolean {
  const flashElapsed = visual.hitFlashStartMs === undefined ? Infinity : nowMs - visual.hitFlashStartMs;
  if (flashIntensity(flashElapsed) > 0) return true;
  if (flashElapsed >= 0) visual.hitFlashStartMs = undefined;
  return false;
}

/** Shadow, hp bar, nameplate — everything that hangs off the body's screen position.
 * Shadow is GROUND-anchored to the SHIFTED ground point; see playerVisual.ts's
 * matching chrome doc for the full rationale. */
interface MonsterChromeUpdate {
  readonly visual: MonsterVisual;
  readonly view: MonsterEntityView;
  readonly context: RenderContext;
  readonly heightAboveGround: number;
  readonly groundHeight: number;
}

function updateMonsterChrome({ visual, view, context, heightAboveGround, groundHeight }: MonsterChromeUpdate): void {
  updateMonsterChromeDepths(visual);
  updateMonsterShadow({ visual, view, heightAboveGround, groundHeight });
  updateMonsterHealthBar(visual, view);
  updateMonsterNameplate(visual, view, context);
}

function updateMonsterChromeDepths(visual: MonsterVisual): void {
  const bodyDepth = visual.body.depth;
  visual.shadow.setDepth(bodyDepth - 0.2);
  visual.hpBar.container.setDepth(bodyDepth + 0.2);
  visual.nameplate.setDepth(bodyDepth + 0.2);
}

function updateMonsterShadow({ visual, view, heightAboveGround, groundHeight }: Omit<MonsterChromeUpdate, "context">): void {
  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition({
    shadow: visual.shadow,
    groundScreenX: ground.x,
    groundScreenY: ground.y - spriteLiftPx(groundHeight),
    heightAboveGround,
  });
}

function updateMonsterHealthBar(visual: MonsterVisual, view: MonsterEntityView): void {
  const headY = visual.body.y - visual.body.displayHeight;
  const healthBarY = headY - NAMEPLATE_GAP_PX - NAMEPLATE_LINE_HEIGHT_PX - LABEL_LINE_GAP_PX - HP_BAR_DISPLAY_HEIGHT_PX / 2;
  updateHpBar({ bar: visual.hpBar, screenX: visual.body.x, screenY: healthBarY, hp: view.hp, maxHp: view.maxHp });
  visual.hpBarRevealed = resolveHpBarVisibility({
    previousHp: visual.lastHp,
    hp: view.hp,
    maxHp: view.maxHp,
    revealed: visual.hpBarRevealed,
  });
  visual.hpBar.container.setVisible(visual.hpBarRevealed);
}

function updateMonsterNameplate(visual: MonsterVisual, view: MonsterEntityView, context: RenderContext): void {
  const headY = visual.body.y - visual.body.displayHeight;
  updateNameplate({
    text: visual.nameplate,
    name: view.name,
    headScreenX: visual.body.x,
    headScreenY: headY,
    distanceTiles: Math.hypot(view.x - context.selfX, view.y - context.selfY),
    isParty: false,
  });
}

/** Advances one monster's full visual for a fresh snapshot sample. */
export function updateMonsterVisual(visual: MonsterVisual, view: MonsterEntityView, ctx: RenderContext): void {
  const groundHeight = ctx.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  visual.lastFx = view.fx;
  updateMonsterBody({ visual, view, context: ctx, heightAboveGround });
  updateMonsterChrome({ visual, view, context: ctx, heightAboveGround, groundHeight });
  visual.lastHp = view.hp;
}
