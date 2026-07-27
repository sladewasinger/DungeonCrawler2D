// Player body visual: feet-anchored hero sprite, held weapon following facing, hit
// flash, downed pose, plus the shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { resolveAnimState } from "../motion/animState.js";
import { createHpBar } from "../presentation/hpBar.js";
import { flashIntensity, tookDamage } from "../combat/hitFlash.js";
import { airborneHeightAboveGround, spriteLiftPx } from "../motion/lift.js";
import { createNameplate } from "../presentation/nameplate.js";
import { inferPlayerAnimState, isRunningPace } from "../motion/playerMotion.js";
import { createShadow } from "../geometry/shadow.js";
import { squashScale } from "../geometry/squash.js";
import type { PlayerVisual } from "./state.js";
import type { PlayerEntityView, RenderContext } from "./view.js";
import { stepOrbitAngle } from "../motion/weaponOrbit.js";
import { depthForEntityNow, worldToScreen } from "../geometry/worldToScreen.js";
import { updatePlayerReviveRing } from "../player/playerReviveRing.js";
import { updatePlayerChrome } from "../player/playerChrome.js";
import { createHeldWeapon, updatePlayerWeapon } from "../player/playerWeaponVisual.js";

const DOWNED_TINT = 0x7a3d3d; const DISCONNECTED_TINT = 0x55555a; const DOWNED_ANGLE = 78;
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
interface PlayerBodyUpdate {
  readonly visual: PlayerVisual;
  readonly skinPrefix: string;
  readonly view: PlayerEntityView;
  readonly context: RenderContext;
  readonly heightAboveGround: number;
}

function updatePlayerBody({
  visual,
  skinPrefix,
  view,
  context,
  heightAboveGround,
}: PlayerBodyUpdate): void {
  positionPlayerBody({ visual, view, heightAboveGround });
  updatePlayerAnimation({ visual, skinPrefix, view, context });
  applyPlayerTint(visual, view, context);
  visual.body.setAngle(view.downed ? DOWNED_ANGLE : 0);
}

function positionPlayerBody({ visual, view, heightAboveGround }: Omit<PlayerBodyUpdate, "skinPrefix" | "context">): void {
  const screen = worldToScreen(view.x, view.y);
  // ELEVATION-PROJECTION section 3: absolute-z lift. Terrain now bakes the matching
  // shift into its own drawn cap (wave E2), so a grounded body (z === groundAt) lands
  // exactly on it — see lift.ts's module doc.
  visual.body.setPosition(screen.x, screen.y - spriteLiftPx(view.z));
  visual.body.setDepth(depthForEntityNow(view.x, view.y, heightAboveGround));
  updatePlayerReviveRing(visual.reviveRing, visual.body, view);
  visual.body.setFlipX(playerFacesLeft(visual, view));
}

function updatePlayerAnimation({ visual, skinPrefix, view, context }: Omit<PlayerBodyUpdate, "heightAboveGround">): void {
  applyPlayerDamageAndSquash(visual, view, context.nowMs);
  applyPlayerAnimationFrame({ visual, skinPrefix, view, nowMs: context.nowMs });
}

function applyPlayerDamageAndSquash(visual: PlayerVisual, view: PlayerEntityView, nowMs: number): void {
  if (visual.hitFlashStartMs === undefined && tookDamage(visual.lastHp, view.hp)) visual.hitFlashStartMs = nowMs;
  applyLandingSquash(visual, view.air, nowMs);
}

interface PlayerAnimationFrameUpdate {
  readonly visual: PlayerVisual;
  readonly skinPrefix: string;
  readonly view: PlayerEntityView;
  readonly nowMs: number;
}

function applyPlayerAnimationFrame({
  visual,
  skinPrefix,
  view,
  nowMs,
}: PlayerAnimationFrameUpdate): void {
  const dt = (nowMs - visual.lastSampleMs) / 1000;
  const dxTiles = view.x - visual.lastX;
  const dyTiles = view.y - visual.lastY;
  const motion = { dxTiles, dyTiles, dtSeconds: dt };
  const anim = inferPlayerAnimState({ ...motion, attacking: view.attacking });
  const resolved = resolveAnimState(skinPrefix, view.downed ? "idle" : anim);
  if (visual.body.anims.currentAnim?.key !== resolved.animKey) visual.body.play(resolved.animKey);
  const running = anim === "walk" && isRunningPace(motion);
  visual.body.anims.timeScale = running ? RUN_ANIM_TIMESCALE : 1;
}

/** Landing-squash edge trigger + scale application, split out of updatePlayerBody to keep its complexity down. */
function applyLandingSquash(visual: PlayerVisual, airborne: boolean, nowMs: number): void {
  if (visual.lastAir && !airborne) visual.squashStartMs = nowMs;
  visual.lastAir = airborne;
  const squash = squashScale(visual.squashStartMs === undefined ? Infinity : nowMs - visual.squashStartMs);
  visual.body.setScale(WORLD_PIXEL_SCALE * squash.scaleX, WORLD_PIXEL_SCALE * squash.scaleY);
}

function applyPlayerTint(visual: PlayerVisual, view: PlayerEntityView, ctx: RenderContext): void {
  const fixedTint = playerStateTint(view);
  if (fixedTint !== null) return void visual.body.setTint(fixedTint);
  const elapsed = visual.hitFlashStartMs === undefined ? Infinity : ctx.nowMs - visual.hitFlashStartMs;
  if (flashIntensity(elapsed) > 0) return setTintFill(visual.body, 0xffffff);
  visual.body.clearTint();
  if (elapsed >= 0) visual.hitFlashStartMs = undefined;
}

function playerStateTint(view: PlayerEntityView): number | null {
  if (view.disconnected) return DISCONNECTED_TINT;
  return view.downed ? DOWNED_TINT : null;
}

function setTintFill(sprite: Phaser.GameObjects.Sprite, color: number): void {
  sprite.setTint(color);
  (sprite as unknown as { setTintMode?: (mode: number) => void }).setTintMode?.(1);
}

function playerFacesLeft(visual: PlayerVisual, view: PlayerEntityView): boolean {
  if (view.weaponId === null || view.weaponAimAngle === null) {
    return view.faceX < 0;
  }
  return Math.cos(visual.weaponAngle) < 0;
}

/** Advances one player's full visual for a fresh snapshot sample. */
export interface PlayerVisualUpdate {
  readonly visual: PlayerVisual;
  readonly skinPrefix: string;
  readonly view: PlayerEntityView;
  readonly context: RenderContext;
}

export function updatePlayerVisual({ visual, skinPrefix, view, context }: PlayerVisualUpdate): void {
  if (view.weaponAimAngle !== null) {
    visual.weaponAngle = stepOrbitAngle(
      visual.weaponAngle,
      view.weaponAimAngle,
      context.dtSeconds,
    );
  }
  const groundHeight = context.world.groundAt(view.x, view.y);
  const heightAboveGround = airborneHeightAboveGround(view.z, groundHeight, view.air);
  updatePlayerBody({ visual, skinPrefix, view, context, heightAboveGround });
  updatePlayerChrome({ visual, view, context, heightAboveGround, groundHeight });
  updatePlayerWeapon({ visual, view, context });
  visual.lastHp = view.hp; visual.lastX = view.x;
  visual.lastY = view.y;
  visual.lastSampleMs = context.nowMs;
}
