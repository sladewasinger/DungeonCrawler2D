/** Renders 0.75x-scaled 32x32 4-directional characters, 360-degree weapons, and off-hand torch/lantern. */
import { SKIN_PALETTES } from "@dc2d/content";
import { DEFAULT_APPEARANCE, TILE_PX, type ArmorEquipment, type PlayerSnapshot } from "@dc2d/engine";
import { Container, Sprite, Text, type Texture } from "pixi.js";
import {
  CHARACTER_WORLD_SCALE, characterCacheKey, getCharacterSpriteSet, resolveFacingDir,
  type CharacterSpriteSet,
} from "../character/characterSprites.js";
import { computeHeldLayout, type OffhandPlacement } from "../character/heldPlacement.js";
import {
  getGrippingHandTexture, getHeldWeaponVisual, getInHandTorchFrames, getWaistLanternFrames,
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

function attachToSlot(slot: Container, child: Container): void { if (child.parent !== slot) slot.addChild(child); }

function makeHandSprite(): Sprite { const s = new Sprite(getGrippingHandTexture()); s.anchor.set(0.5, 0.5); return s; }

export class PlayerView {
  readonly root = new Container();
  private readonly backSlot = new Container();
  private readonly frontSlot = new Container();
  private readonly body: Sprite;
  private readonly heldGroup = new Container();
  private readonly weaponSprite = new Sprite();
  private readonly handSprite = makeHandSprite();
  private readonly offhandGroup = new Container();
  private readonly offhandSprite = new Sprite();
  private readonly offhandHandSprite = makeHandSprite();
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
    this.heldGroup.addChild(this.weaponSprite, this.handSprite);
    this.heldGroup.visible = false;
    this.offhandGroup.addChild(this.offhandSprite, this.offhandHandSprite);
    this.offhandGroup.scale.set(CHARACTER_WORLD_SCALE);
    this.offhandGroup.visible = false;
    this.label = createNameLabel(snap.name);
    this.root.addChild(this.backSlot, this.body, this.frontSlot, this.label);
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
    this.syncPose(snap, timeSec);
    this.syncGear(snap, timeSec);
  }

  private syncAppearanceSet(snap: PlayerSnapshot): void {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    const key = characterCacheKey(appearance, armor);
    if (key === this.appearanceKey) return;
    this.appearanceKey = key;
    this.sprites = getCharacterSpriteSet(appearance, armor);
  }

  private syncPose(snap: PlayerSnapshot, timeSec: number): void {
    if (this.label.text !== snap.name) this.label.text = snap.name;
    const { dir, flipX } = resolveFacingDir(snap.facingX, snap.facingY);
    const list = snap.moving ? this.sprites[dir].run : this.sprites[dir].idle;
    const nextTex = list[Math.floor(timeSec * (snap.moving ? 11 : 5)) % list.length];
    if (nextTex) this.body.texture = nextTex;
    this.body.scale.set(flipX ? -CHARACTER_WORLD_SCALE : CHARACTER_WORLD_SCALE, CHARACTER_WORLD_SCALE);
  }

  private syncGear(snap: PlayerSnapshot, timeSec: number): void {
    const visual = getHeldWeaponVisual(snap.heldItem, timeSec);
    const layout = gearLayoutFor(snap, visual, timeSec);
    const tint = skinTint((snap.appearance ?? DEFAULT_APPEARANCE).skin);
    this.syncMainHand(tint, visual, layout.main);
    this.syncOffhand(tint, layout.offhand, timeSec);
  }

  private syncMainHand(
    tint: number,
    visual: ReturnType<typeof getHeldWeaponVisual>,
    main: ReturnType<typeof computeHeldLayout>["main"],
  ): void {
    if (!visual) { this.heldGroup.visible = false; return; }
    this.weaponSprite.texture = visual.texture;
    this.weaponSprite.anchor.set(visual.anchorX, visual.anchorY);
    this.handSprite.visible = visual.showHand;
    this.handSprite.tint = tint;
    this.heldGroup.position.set(main.x, main.y);
    this.heldGroup.rotation = main.rotation;
    this.heldGroup.scale.set(main.scaleX, main.scaleY);
    this.heldGroup.visible = true;
    attachToSlot(main.behindBody ? this.backSlot : this.frontSlot, this.heldGroup);
  }

  private syncOffhand(tint: number, off: OffhandPlacement, timeSec: number): void {
    if (off.kind === "none") { this.offhandGroup.visible = false; return; }
    const frames = off.kind === "torch" ? getInHandTorchFrames() : getWaistLanternFrames();
    const tex = frames[Math.floor(timeSec * (off.kind === "torch" ? 10 : 4)) % frames.length];
    if (tex) this.offhandSprite.texture = tex;
    this.offhandSprite.anchor.set(0.5, off.kind === "torch" ? 0.72 : 0.5);
    this.offhandHandSprite.visible = off.kind === "torch";
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
