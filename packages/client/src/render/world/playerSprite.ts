/** Renders 3D 8-dir Hero sprites (`144x144` @ `0.3333`) with 2-segment IK arms, falling back to legacy 2D sprites in headless tests. */
import { DEFAULT_APPEARANCE, JUMP_VISUAL_PX_PER_TILE, TILE_PX, advanceGaitClock, createGaitClock, type ArmorEquipment, type PlayerSnapshot } from "@dc2d/engine";
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { ARM_PIVOT_ANCHOR, type ArmPlacement } from "../character/armRig.js";
import { CHARACTER_WORLD_SCALE, characterCacheKey, getCharacterSpriteSet, type CharacterSpriteSet, type FacingDir } from "../character/characterSprites.js";
import { computeActorCombatFx, type HeldLayout, type OffhandPlacement, type ShieldPlacement } from "../character/heldPlacement.js";
import { getGearScale, getGrippingHandTexture, getHeldWeaponVisual, getShieldTexture, getWaistLanternFrames, type HeldWeaponVisual } from "../character/heldWeapons.js";
import { sampleShoulderSockets } from "../character/playerAssets.js";
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";
import { PlayerArmRigView, computeTwoSegmentArmRig } from "./playerArmIk.js";
import { PlayerHpBar, createPlayerNameLabel } from "./playerHpBar.js";
import {
  computePlayerCombatFx, gearLayoutFor, nextDodgeStart, resolvePlayerFacing,
  resolvePoseSnapshot, skinTint, solveLegacyArmRigForSnap, type ActivePose,
} from "./playerPoseHelpers.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null, offhand: null };

function attachToSlot(slot: Container, child: Container): void { if (child.parent !== slot) slot.addChild(child); }
function makeHandSprite(): Sprite { const s = new Sprite(getGrippingHandTexture()); s.anchor.set(0.5, 0.5); return s; }
function makeArmSprite(): Sprite { const s = new Sprite(); s.anchor.set(ARM_PIVOT_ANCHOR.x, ARM_PIVOT_ANCHOR.y); return s; }
function makeShieldSprite(): Sprite {
  const s = new Sprite(getShieldTexture());
  s.anchor.set(0.5, 0.5); s.zIndex = 2;
  s.visible = false; return s;
}
function makeGroundShadow(): Graphics {
  const g = new Graphics();
  g.ellipse(0, 0, 7, 2.2).fill({ color: 0x0c1018, alpha: 0.34 });
  g.ellipse(0, 0, 5, 1.3).fill({ color: 0x0c1018, alpha: 0.2 });
  return g;
}

export class PlayerView {
  readonly root = new Container();
  private readonly groundShadow = makeGroundShadow();
  private readonly actorGroup = new Container();
  private readonly backSlot = new Container();
  private readonly frontSlot = new Container();
  private readonly body: Sprite;
  private readonly heldGroup = new Container();
  private readonly weaponSprite = new Sprite();
  private readonly handSprite = makeHandSprite();
  private readonly secondaryHandSprite = makeHandSprite();
  private readonly offhandGroup = new Container();
  private readonly offhandSprite = new Sprite();
  private readonly offhandHandSprite = makeHandSprite();
  private readonly rightArmSprite = makeArmSprite();
  private readonly leftArmSprite = makeArmSprite();
  private readonly armRigView = new PlayerArmRigView();
  private readonly shieldSprite = makeShieldSprite();
  private readonly hpBar = new PlayerHpBar();
  private readonly label: Text;
  private appearanceKey = "";
  private sprites: CharacterSpriteSet;
  private lastFacing: { readonly dir: FacingDir; readonly flipX: boolean } = { dir: "south", flipX: false };
  private dodgeStartSec: number | null = null;
  private readonly gaitClock = createGaitClock();

  constructor(_torchTex: Texture, snap: PlayerSnapshot) {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    this.appearanceKey = characterCacheKey(appearance, armor);
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.body = new Sprite(this.sprites.south.idle[0]);
    this.applyBodyMetrics();
    this.backSlot.sortableChildren = true;
    this.frontSlot.sortableChildren = true;
    this.heldGroup.addChild(this.weaponSprite, this.handSprite, this.secondaryHandSprite);
    this.heldGroup.visible = false;
    this.heldGroup.zIndex = 2;
    this.offhandGroup.addChild(this.offhandSprite, this.offhandHandSprite);
    this.offhandGroup.visible = false;
    this.offhandGroup.zIndex = 2;
    this.label = createPlayerNameLabel(snap.name);
    this.actorGroup.addChild(this.backSlot, this.body, this.frontSlot);
    this.root.addChild(this.groundShadow, this.actorGroup, this.hpBar.root, this.label);
  }

  sync(input: {
    readonly snap: PlayerSnapshot; readonly torchFrames: readonly Texture[];
    readonly timeSec: number; readonly visualElev?: number; readonly sortBoost?: number;
  }): void {
    const { snap, timeSec } = input;
    const elev = input.visualElev ?? snap.elevation;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - elev * ELEVATION_LIFT_PX);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + (input.sortBoost ?? snap.elevation * 2);
    this.syncAppearanceSet(snap);
    this.syncBodyTransform(snap, timeSec);
    const gait = advanceGaitClock(this.gaitClock, { x: snap.x, y: snap.y, moving: snap.moving, sprinting: Boolean(snap.sprinting), airborne: (snap.jumpZ ?? 0) > 0.03 });
    const activePose = this.syncPose(snap, timeSec, gait.phase);
    this.syncGear({ snap, active: activePose, timeSec, gaitPhase: gait.phase });
  }

  private applyBodyMetrics(): void {
    const scale = this.sprites.worldScale ?? CHARACTER_WORLD_SCALE;
    this.body.anchor.set(0.5, this.sprites.anchorY ?? 0.91);
    this.body.scale.set(scale);
  }

  private syncBodyTransform(snap: PlayerSnapshot, timeSec: number): void {
    const jumpZ = snap.jumpZ ?? 0;
    const jumpPx = jumpZ * JUMP_VISUAL_PX_PER_TILE;
    const fx = computePlayerCombatFx(snap, timeSec, Boolean(this.sprites.is3d));
    this.applyActorFx(fx, jumpZ, jumpPx);
    const barVisible = this.hpBar.sync({ snap, jumpPx, timeSec });
    this.label.position.y = (barVisible ? -32 : -27) - jumpPx;
  }

  private applyActorFx(fx: ReturnType<typeof computeActorCombatFx>, jumpZ: number, jumpPx: number): void {
    this.actorGroup.position.set(fx.x, -jumpPx + fx.y);
    this.actorGroup.alpha = fx.alpha; this.actorGroup.rotation = fx.rot;
    this.body.tint = fx.tint; this.armRigView.setTint(fx.tint);
    this.rightArmSprite.tint = fx.tint; this.leftArmSprite.tint = fx.tint;
    this.groundShadow.scale.set(Math.max(0.55, 1 - jumpZ * 0.65));
    this.groundShadow.alpha = Math.max(0.45, 1 - jumpZ * 0.7);
  }

  private syncAppearanceSet(snap: PlayerSnapshot): void {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    const key = characterCacheKey(appearance, armor);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.applyBodyMetrics();
  }

  private syncPose(snap: PlayerSnapshot, timeSec: number, gaitPhase: number): ActivePose {
    if (this.label.text !== snap.name) this.label.text = snap.name;
    const is3d = Boolean(this.sprites.is3d);
    const facing = resolvePlayerFacing({ snap, is3d, prev: this.lastFacing });
    if (is3d) this.lastFacing = facing;
    this.dodgeStartSec = nextDodgeStart(snap.dodging, timeSec, this.dodgeStartSec);
    const anim = this.sprites[facing.dir] ?? this.sprites.south;
    const { active, texture } = resolvePoseSnapshot({ anim, facing, snap, is3d, timeSec, dodgeStartSec: this.dodgeStartSec, gaitPhase });
    if (texture) this.body.texture = texture;
    const scale = this.sprites.worldScale ?? CHARACTER_WORLD_SCALE;
    this.body.scale.set(facing.flipX ? -scale : scale, scale);
    return active;
  }

  private syncGear(opts: { readonly snap: PlayerSnapshot; readonly active: ActivePose; readonly timeSec: number; readonly gaitPhase: number }): void {
    const { snap, active, timeSec, gaitPhase } = opts;
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const seg = this.sprites.armSegments;
    const handTex = seg ? seg.handFront : getGrippingHandTexture(appearance.body === "female");
    this.handSprite.texture = handTex;
    this.secondaryHandSprite.texture = handTex;
    this.offhandHandSprite.texture = handTex;
    if ((snap.respawnTimer ?? 0) > 0 || (this.sprites.is3d && snap.dodging)) {
      this.hideAllGearAndArms();
      return;
    }
    const visual = getHeldWeaponVisual(snap.heldItem, timeSec, snap.bowCharge);
    const layout = gearLayoutFor({ snap, visual, timeSec, is3d: Boolean(this.sprites.is3d), active, gaitPhase });
    const handTint = seg ? this.body.tint : skinTint(appearance.skin);
    this.syncMainHand(handTint, visual, layout.main);
    this.syncOffhand(handTint, layout.offhand, timeSec);
    this.syncShield(layout.shield);
    this.syncArmsForPose(snap, active, { layout, visual });
  }

  private syncArmsForPose(snap: PlayerSnapshot, active: ActivePose, ctx: { readonly layout: HeldLayout; readonly visual: HeldWeaponVisual | null }): void {
    if (this.sprites.is3d && this.sprites.armSegments) { this.sync3dArms(snap, active, ctx); return; }
    this.syncLegacyArms(snap, active, ctx);
  }

  private sync3dArms(
    snap: PlayerSnapshot,
    active: ActivePose,
    ctx: { readonly layout: HeldLayout; readonly visual: HeldWeaponVisual | null },
  ): void {
    this.rightArmSprite.visible = false;
    this.leftArmSprite.visible = false;
    const body = (snap.appearance ?? DEFAULT_APPEARANCE).body;
    const seg = this.sprites.armSegments;
    const sockets = sampleShoulderSockets({ body, clip: active.clip, dir: active.dir, frameIdx: active.frameIdx, flipX: active.flipX });
    if (!sockets || !seg) { this.armRigView.setVisible(false); return; }
    const rig = computeTwoSegmentArmRig({
      sockets, dir: active.dir, flipX: active.flipX, layout: ctx.layout,
      grips: ctx.visual?.grips ?? null, pose: active.pose, airborne: active.airborne,
      bowCharge: snap.bowCharge ?? 0, body, swinging: Boolean(snap.swingProgress),
    });
    this.armRigView.apply({ rig, segments: seg, backSlot: this.backSlot, frontSlot: this.frontSlot, worldScale: this.sprites.worldScale ?? CHARACTER_WORLD_SCALE });
  }

  private syncLegacyArms(
    snap: PlayerSnapshot,
    active: ActivePose,
    ctx: { readonly layout: HeldLayout; readonly visual: HeldWeaponVisual | null },
  ): void {
    this.armRigView.setVisible(false);
    const rig = solveLegacyArmRigForSnap({ snap, active, layout: ctx.layout, visual: ctx.visual });
    this.syncArm(this.rightArmSprite, rig.right);
    this.syncArm(this.leftArmSprite, rig.left);
  }

  private hideAllGearAndArms(): void {
    this.heldGroup.visible = false; this.offhandGroup.visible = false;
    this.shieldSprite.visible = false; this.armRigView.setVisible(false);
    this.rightArmSprite.visible = false; this.leftArmSprite.visible = false;
  }

  private syncShield(shield: ShieldPlacement): void {
    if (!shield.equipped) { this.shieldSprite.visible = false; return; }
    const scale = this.sprites.is3d ? getGearScale("gear-shield") : CHARACTER_WORLD_SCALE;
    this.shieldSprite.texture = getShieldTexture();
    this.shieldSprite.position.set(shield.x, shield.y);
    this.shieldSprite.rotation = shield.rotation;
    this.shieldSprite.scale.set(Math.sign(shield.scaleX) * scale, scale);
    this.shieldSprite.visible = true;
    attachToSlot(shield.behindBody ? this.backSlot : this.frontSlot, this.shieldSprite);
  }

  private syncArm(sprite: Sprite, arm: ArmPlacement): void {
    sprite.texture = arm.shaded ? this.sprites.backArm : this.sprites.frontArm;
    sprite.position.set(arm.x, arm.y);
    sprite.rotation = arm.rotation;
    sprite.scale.set(arm.scaleX, arm.scaleY);
    sprite.zIndex = arm.overWeapon ? 3 : 1;
    sprite.visible = true;
    attachToSlot(arm.behindBody ? this.backSlot : this.frontSlot, sprite);
  }

  private syncMainHand(tint: number, visual: HeldWeaponVisual | null, main: HeldLayout["main"]): void {
    if (!visual) { this.heldGroup.visible = false; return; }
    this.weaponSprite.texture = visual.texture;
    this.weaponSprite.anchor.set(visual.anchorX, visual.anchorY);
    this.handSprite.visible = visual.grips.primary.showHand;
    this.handSprite.position.set(visual.grips.primary.x, visual.grips.primary.y);
    this.handSprite.tint = tint;
    const sec = visual.grips.secondary;
    this.secondaryHandSprite.visible = Boolean(sec?.showHand);
    if (sec) this.secondaryHandSprite.position.set(sec.x, sec.y);
    this.secondaryHandSprite.tint = tint;
    this.heldGroup.position.set(main.x, main.y);
    this.heldGroup.rotation = main.rotation;
    this.heldGroup.scale.set(main.scaleX, main.scaleY);
    this.heldGroup.visible = true;
    attachToSlot(main.behindBody ? this.backSlot : this.frontSlot, this.heldGroup);
  }

  private syncOffhand(tint: number, off: OffhandPlacement, timeSec: number): void {
    if (off.kind === "none") { this.offhandGroup.visible = false; return; }
    const frames = getWaistLanternFrames();
    const scale = this.sprites.is3d ? getGearScale("gear-lantern-0") : CHARACTER_WORLD_SCALE;
    const tex = frames[Math.floor(timeSec * 4) % frames.length];
    if (tex) this.offhandSprite.texture = tex;
    this.offhandSprite.anchor.set(0.5, off.kind === "handLantern" ? 0.18 : 0.5);
    this.offhandHandSprite.visible = off.kind === "handLantern";
    this.offhandHandSprite.tint = tint;
    this.offhandGroup.scale.set(scale);
    this.offhandGroup.position.set(off.x, off.y);
    this.offhandGroup.rotation = off.rotation;
    this.offhandGroup.visible = true;
    attachToSlot(off.behindBody ? this.backSlot : this.frontSlot, this.offhandGroup);
  }
}
