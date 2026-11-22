/** Renders 0.75x-scaled 32x32 4-directional characters, jump/fall shadow lift, and dominant-hand gear. */
import { SKIN_PALETTES } from "@dc2d/content";
import {
  DEFAULT_APPEARANCE, JUMP_VISUAL_PX_PER_TILE, TILE_PX,
  type ArmorEquipment, type PlayerSnapshot,
} from "@dc2d/engine";
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  ARM_PIVOT_ANCHOR, computeArmRig, type AirborneState, type ArmPlacement,
} from "../character/armRig.js";
import {
  CHARACTER_WORLD_SCALE, characterCacheKey, getCharacterSpriteSet, resolveFacingDir,
  type CharacterSpriteSet, type DirectionAnim,
} from "../character/characterSprites.js";
import {
  FALL_POSES, IDLE_POSES, JUMP_POSES, RUN_POSES, type CharacterPose, type FacingDir,
} from "../character/characterTypes.js";
import { computeHeldLayout, type CardinalFacing, type OffhandPlacement } from "../character/heldPlacement.js";
import {
  getGrippingHandTexture, getHeldWeaponVisual, getWaistLanternFrames,
} from "../character/heldWeapons.js";
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null };
const FALLBACK_VISUAL = { twoHanded: false, aimMode: "upright" as const, spriteScale: CHARACTER_WORLD_SCALE };

function skinTint(skinId: string): number {
  return Number.parseInt((SKIN_PALETTES[skinId] ?? SKIN_PALETTES.warm!).base.slice(1), 16);
}

function gearLayoutFor(snap: PlayerSnapshot, visual: ReturnType<typeof getHeldWeaponVisual>, timeSec: number) {
  const v = visual ?? FALLBACK_VISUAL;
  return computeHeldLayout({
    aimX: snap.aimX ?? snap.facingX, aimY: snap.aimY ?? snap.facingY,
    heldItem: snap.heldItem ?? null, torchLit: snap.torchLit,
    twoHanded: v.twoHanded, aimMode: v.aimMode, itemScale: v.spriteScale, timeSec, moving: snap.moving,
  });
}

interface PoseTrack {
  readonly textures: readonly Texture[];
  readonly poses: readonly CharacterPose[];
  readonly fps: number;
  readonly airborne: AirborneState;
}

interface ActivePose {
  readonly facing: CardinalFacing;
  readonly pose: CharacterPose;
  readonly airborne: AirborneState;
}

function resolvePoseTrack(anim: DirectionAnim, snap: PlayerSnapshot): PoseTrack {
  if ((snap.jumpZ ?? 0) > 0.01) {
    return (snap.jumpVz ?? 0) > 0.35
      ? { textures: anim.jump, poses: JUMP_POSES, fps: 8, airborne: "jump" }
      : { textures: anim.fall, poses: FALL_POSES, fps: 8, airborne: "fall" };
  }
  return snap.moving
    ? { textures: anim.run, poses: RUN_POSES, fps: 11, airborne: "ground" }
    : { textures: anim.idle, poses: IDLE_POSES, fps: 5, airborne: "ground" };
}

function attachToSlot(slot: Container, child: Container): void { if (child.parent !== slot) slot.addChild(child); }

function makeHandSprite(): Sprite { const s = new Sprite(getGrippingHandTexture()); s.anchor.set(0.5, 0.5); return s; }

function makeArmSprite(): Sprite { const s = new Sprite(); s.anchor.set(ARM_PIVOT_ANCHOR.x, ARM_PIVOT_ANCHOR.y); return s; }

function cardinalFromDir(dir: FacingDir, flipX: boolean): CardinalFacing {
  return dir === "side" ? (flipX ? "west" : "east") : dir;
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
  private readonly label: Text;
  private appearanceKey = "";
  private sprites: CharacterSpriteSet;

  constructor(_torchTex: Texture, snap: PlayerSnapshot) {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    this.appearanceKey = characterCacheKey(appearance, armor);
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.body = new Sprite(this.sprites.south.idle[0]);
    this.body.anchor.set(0.5, 0.91);
    this.body.scale.set(CHARACTER_WORLD_SCALE);
    this.backSlot.sortableChildren = true;
    this.frontSlot.sortableChildren = true;
    this.heldGroup.addChild(this.weaponSprite, this.handSprite, this.secondaryHandSprite);
    this.heldGroup.visible = false;
    this.heldGroup.zIndex = 2;
    this.offhandGroup.addChild(this.offhandSprite, this.offhandHandSprite);
    this.offhandGroup.scale.set(CHARACTER_WORLD_SCALE);
    this.offhandGroup.visible = false;
    this.offhandGroup.zIndex = 2;
    this.label = createNameLabel(snap.name);
    this.actorGroup.addChild(this.backSlot, this.body, this.frontSlot);
    this.root.addChild(this.groundShadow, this.actorGroup, this.label);
  }

  sync(input: {
    readonly snap: PlayerSnapshot;
    readonly torchFrames: readonly Texture[];
    readonly timeSec: number;
    readonly visualElev?: number;
    readonly sortBoost?: number;
  }): void {
    const { snap, timeSec } = input;
    const elev = input.visualElev ?? snap.elevation;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - elev * ELEVATION_LIFT_PX);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + (input.sortBoost ?? snap.elevation * 2);
    this.syncAppearanceSet(snap);
    this.syncJumpAndShadow(snap);
    const activePose = this.syncPose(snap, timeSec);
    this.syncGear(snap, activePose, timeSec);
  }

  private syncAppearanceSet(snap: PlayerSnapshot): void {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    const key = characterCacheKey(appearance, armor);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    this.sprites = getCharacterSpriteSet(appearance, armor);
  }

  private syncJumpAndShadow(snap: PlayerSnapshot): void {
    const jumpZ = snap.jumpZ ?? 0;
    const jumpPx = jumpZ * JUMP_VISUAL_PX_PER_TILE;
    this.actorGroup.position.y = -jumpPx;
    this.label.position.y = -27 - jumpPx;
    this.groundShadow.scale.set(Math.max(0.55, 1 - jumpZ * 0.65));
    this.groundShadow.alpha = Math.max(0.45, 1 - jumpZ * 0.7);
  }

  private syncPose(snap: PlayerSnapshot, timeSec: number): ActivePose {
    if (this.label.text !== snap.name) this.label.text = snap.name;
    const { dir, flipX } = resolveFacingDir(snap.facingX, snap.facingY);
    const track = resolvePoseTrack(this.sprites[dir], snap);
    const idx = Math.floor(timeSec * track.fps) % track.textures.length;
    const nextTex = track.textures[idx];
    if (nextTex) this.body.texture = nextTex;
    this.body.scale.set(flipX ? -CHARACTER_WORLD_SCALE : CHARACTER_WORLD_SCALE, CHARACTER_WORLD_SCALE);
    return {
      facing: cardinalFromDir(dir, flipX),
      pose: track.poses[idx] ?? IDLE_POSES[0]!,
      airborne: track.airborne,
    };
  }

  private syncGear(snap: PlayerSnapshot, active: ActivePose, timeSec: number): void {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const female = appearance.body === "female";
    const handTex = getGrippingHandTexture(female);
    this.handSprite.texture = handTex;
    this.secondaryHandSprite.texture = handTex;
    this.offhandHandSprite.texture = handTex;
    const visual = getHeldWeaponVisual(snap.heldItem, timeSec);
    const layout = gearLayoutFor(snap, visual, timeSec);
    const tint = skinTint(appearance.skin);
    const ax = snap.aimX ?? snap.facingX;
    const ay = snap.aimY ?? snap.facingY;
    const aimDir = resolveFacingDir(ax, ay);
    const facing = Math.hypot(ax, ay) < 0.01 ? active.facing : cardinalFromDir(aimDir.dir, aimDir.flipX);
    const rig = computeArmRig({
      facing, female, pose: active.pose, airborneState: active.airborne, grips: visual?.grips ?? null, layout,
    });
    this.syncMainHand(tint, visual, layout.main);
    this.syncOffhand(tint, layout.offhand, timeSec);
    this.syncArm(this.rightArmSprite, rig.right);
    this.syncArm(this.leftArmSprite, rig.left);
  }

  private syncArm(sprite: Sprite, arm: ArmPlacement): void {
    sprite.texture = arm.shaded ? this.sprites.backArm : this.sprites.frontArm;
    sprite.position.set(arm.x, arm.y);
    sprite.rotation = arm.rotation;
    sprite.scale.set(arm.scaleX, arm.scaleY);
    sprite.zIndex = arm.overWeapon ? 3 : 1;
    attachToSlot(arm.behindBody ? this.backSlot : this.frontSlot, sprite);
  }

  private syncMainHand(
    tint: number,
    visual: ReturnType<typeof getHeldWeaponVisual>,
    main: ReturnType<typeof computeHeldLayout>["main"],
  ): void {
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
    const tex = frames[Math.floor(timeSec * 4) % frames.length];
    if (tex) this.offhandSprite.texture = tex;
    this.offhandSprite.anchor.set(0.5, off.kind === "handLantern" ? 0.18 : 0.5);
    this.offhandHandSprite.visible = off.kind === "handLantern";
    this.offhandHandSprite.tint = tint;
    this.offhandGroup.position.set(off.x, off.y);
    this.offhandGroup.rotation = off.rotation;
    this.offhandGroup.visible = true;
    attachToSlot(off.behindBody ? this.backSlot : this.frontSlot, this.offhandGroup);
  }
}

function createNameLabel(name: string): Text {
  const label = new Text({
    text: name, resolution: 2, roundPixels: false, textureStyle: { scaleMode: "linear" },
    style: {
      fontSize: 28, fontWeight: "700", fill: 0xf8fafc,
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      stroke: { color: 0x0f172a, width: 6, join: "round" },
    },
  });
  label.anchor.set(0.5, 1);
  label.scale.set(0.24);
  label.position.set(0, -27);
  return label;
}
