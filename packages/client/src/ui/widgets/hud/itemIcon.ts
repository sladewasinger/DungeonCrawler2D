/**
 * Hotbar/weapon icon builder: maps item ids to real atlas frames, with a generated
 * fallback (tinted chip + initial letter) for items the 0x72 pack has no icon for
 * (assets/INVENTORY.md GAP #6 — rag/stick/bandage/raw-meat/torch).
 */
import type Phaser from "phaser";
import { pixelTextStyle } from "../../font.js";
import { PANEL_BORDER } from "../../panel.js";
import { ASSET_KEYS } from "../../../boot/assetManifest.js";

const ITEM_ICON_FRAMES: Readonly<Record<string, string>> = {
  knife: "weapon_knife",
  sword: "weapon_rusty_sword",
  hammer: "weapon_hammer",
  "water-flask": "flask_blue",
  "vodka-bottle": "flask_red",
};

const FALLBACK_TINT = 0x6b6b7e;

/** The atlas frame mapped to an item id, or null when it falls back to the generated chip. */
export function itemIconFrame(itemId: string): string | null {
  return ITEM_ICON_FRAMES[itemId] ?? null;
}

/**
 * Builds one item's icon centered at local (0,0), always as a Container so callers
 * don't need to special-case sprite vs. fallback game objects.
 */
export function createItemIcon(scene: Phaser.Scene, itemId: string, size: number): Phaser.GameObjects.Container {
  const frame = itemIconFrame(itemId);
  if (frame) return createSpriteIcon(scene, frame, size);
  return createFallbackIcon(scene, itemId, size);
}

function createSpriteIcon(scene: Phaser.Scene, frame: string, size: number): Phaser.GameObjects.Container {
  const sprite = scene.add.sprite(0, 0, ASSET_KEYS.atlas, frame);
  const scale = (size * 0.7) / Math.max(sprite.width, sprite.height);
  sprite.setScale(scale);
  return scene.add.container(0, 0, [sprite]);
}

function createFallbackIcon(scene: Phaser.Scene, itemId: string, size: number): Phaser.GameObjects.Container {
  const box = scene.add.rectangle(0, 0, size * 0.6, size * 0.6, FALLBACK_TINT).setStrokeStyle(1, PANEL_BORDER);
  const letter = scene.add.text(0, 0, itemId.charAt(0).toUpperCase(), pixelTextStyle(12)).setOrigin(0.5, 0.5);
  return scene.add.container(0, 0, [box, letter]);
}
