/** Renders modular HD-pixel paper-doll characters with equipped armor, held items, torch, and HiDPI names. */
import { DEFAULT_APPEARANCE, TILE_PX, type ArmorEquipment, type PlayerSnapshot } from "@dc2d/engine";
import { Container, Sprite, Text, type Texture } from "pixi.js";
import { getItemHeldTexture } from "../../ui/icons/itemIcons.js";
import { characterCacheKey, getCharacterSpriteSet, type CharacterSpriteSet } from "../character/characterSprites.js";
import { ELEVATION_LIFT_PX } from "./cliffStrips.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null };

export class PlayerView {
  readonly root = new Container();
  private readonly body: Sprite;
  private readonly torch: Sprite;
  private readonly held: Sprite;
  private readonly label: Text;
  private renderedItemId: string | null = null;
  private appearanceKey = "";
  private sprites: CharacterSpriteSet;

  constructor(torchTex: Texture, snap: PlayerSnapshot) {
    const appearance = snap.appearance ?? DEFAULT_APPEARANCE;
    const armor = snap.armor ?? EMPTY_ARMOR;
    this.appearanceKey = characterCacheKey(appearance, armor);
    this.sprites = getCharacterSpriteSet(appearance, armor);
    this.body = new Sprite(this.sprites.idle[0]);
    this.body.anchor.set(0.5, 0.92);
    this.torch = new Sprite(torchTex);
    this.torch.anchor.set(0.5, 0.85);
    this.torch.position.set(7, -6);
    this.torch.scale.set(0.75);
    this.held = new Sprite();
    this.held.anchor.set(0.5, 0.65);
    this.held.position.set(-6, -4);
    this.held.scale.set(0.65);
    this.held.visible = false;
    this.label = createNameLabel(snap.name);
    this.root.addChild(this.torch, this.held, this.body, this.label);
  }

  sync(input: {
    readonly snap: PlayerSnapshot;
    readonly torchFrames: readonly Texture[];
    readonly timeSec: number;
    readonly visualElev?: number;
    readonly sortBoost?: number;
  }): void {
    const { snap, torchFrames, timeSec } = input;
    const elev = input.visualElev ?? snap.elevation;
    this.root.position.set(snap.x * TILE_PX, snap.y * TILE_PX - elev * ELEVATION_LIFT_PX);
    this.root.zIndex = Math.round(snap.y * TILE_PX) + (input.sortBoost ?? snap.elevation * 2);
    this.syncAppearanceSet(snap);
    this.syncPose(snap, timeSec);
    this.syncTorch(snap.torchLit, torchFrames, timeSec);
    this.syncHeldItem(snap);
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
    const list = snap.moving ? this.sprites.run : this.sprites.idle;
    const nextTex = list[Math.floor(timeSec * (snap.moving ? 10 : 6)) % list.length];
    if (nextTex) this.body.texture = nextTex;
    if (Math.abs(snap.facingX) > 0.1) this.body.scale.x = snap.facingX < 0 ? -1 : 1;
  }

  private syncTorch(lit: boolean, torchFrames: readonly Texture[], timeSec: number): void {
    this.torch.visible = lit;
    if (!lit || torchFrames.length === 0) return;
    const tf = torchFrames[Math.floor(timeSec * 12) % torchFrames.length];
    if (tf) this.torch.texture = tf;
    this.torch.position.x = this.body.scale.x * 7;
  }

  private syncHeldItem(snap: PlayerSnapshot): void {
    const itemId = snap.heldItem ?? null;
    if (!itemId || (itemId === "torch" && snap.torchLit)) {
      this.held.visible = false;
      return;
    }
    if (itemId !== this.renderedItemId) {
      this.renderedItemId = itemId;
      const tex = getItemHeldTexture(itemId);
      if (tex) this.held.texture = tex;
    }
    const dir = this.body.scale.x;
    this.held.position.set(-dir * 6, -4);
    this.held.scale.set(dir * 0.65, 0.65);
    this.held.visible = true;
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
  label.position.set(0, -28);
  return label;
}
