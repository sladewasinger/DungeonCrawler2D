// Player body visual: feet-anchored hero sprite, held weapon following facing, hit
// flash, downed pose, plus the shared combatant chrome (shadow/hp/nameplate).
import type Phaser from "phaser";
import { ASSET_KEYS, WORLD_PIXEL_SCALE } from "../../../boot/assetManifest.js";
import { resolveAnimState } from "../motion/animState.js";
import { createHpBar } from "../presentation/hpBar.js";
import { flashIntensity, tookDamage } from "../combat/feedback/hitFlash.js";
import { airborneHeightAboveGround, spriteLiftPx } from "../motion/lift.js";
import { createNameplate } from "../presentation/nameplate.js";
import { inferPlayerAnimState, isRunningPace } from "../motion/playerMotion.js";
import { createShadow } from "../geometry/shadow.js";
import { squashScale } from "../geometry/squash.js";
import type { PlayerVisual } from "./state.js";
import type { PlayerEntityView, RenderContext } from "./view.js";
import { stepOrbitAngle } from "../motion/weaponOrbit.js";
import { depthForEntityNow, worldToScreen } from "../geometry/worldToScreen.js";
import { updatePlayerChrome } from "../player/playerChrome.js";
import { createHeldWeapon, updatePlayerWeapon } from "../player/playerWeaponVisual.js";
import { playerFacesLeft } from "../player/playerFacing.js";
import {
  applyCombatantTint,
  resolveCombatantTint,
  resolveCombatantTintLayer,
  type CombatantStateVisual,
} from "../combat/status/statusTint.js";
import { createAttackCooldownIndicator } from "../combat/attack/attackCooldownIndicator.js";
import { createAdminLabel } from "../presentation/adminLabel.js";

const DOWNED_ANGLE = 78;
/** Epic 7.12: no dedicated run frames exist, so running plays the same walk loop
 * faster instead — see playerMotion.ts's isRunningPace doc comment. */
const RUN_ANIM_TIMESCALE = 1.35;

export function createPlayerVisual(scene: Phaser.Scene, nowMs: number): PlayerVisual {
  const body = scene.add.sprite(0, 0, ASSET_KEYS.atlas).setOrigin(0.5, 1).setScale(WORLD_PIXEL_SCALE);
  return {
    kind: "player",
    body,
    weapon: createHeldWeapon(scene, 0),
    adminLabel: createAdminLabel(scene, 0),
    guardCone: scene.add.graphics(),
    attackCooldownIndicator: createAttackCooldownIndicator(scene),
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
  visual.body.setFlipX(playerFacesLeft(view));
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
  const elapsed = visual.hitFlashStartMs === undefined ? Infinity : ctx.nowMs - visual.hitFlashStartMs;
  const damageFlashing = flashIntensity(elapsed) > 0;
  const layer = resolveCombatantTintLayer(damageFlashing, playerStateVisual(view), false);
  applyCombatantTint(
    visual.body,
    resolveCombatantTint(view.fx, ctx.nowMs, layer),
  );
  if (!damageFlashing && elapsed >= 0) visual.hitFlashStartMs = undefined;
}

function playerStateVisual(view: PlayerEntityView): CombatantStateVisual {
  if (view.disconnected) return "disconnected";
  return view.downed ? "downed" : "normal";
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
