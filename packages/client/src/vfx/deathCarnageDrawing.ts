import Phaser from "phaser";
import {
  ASSET_KEYS,
  WORLD_PIXEL_SCALE,
} from "../boot/assetManifest.js";
import { monsterSpriteFor } from "../render/entities/spriteMap.js";
import { worldToScreen } from "../render/entities/worldToScreen.js";

const BASE_ALPHA = 0.88;
const BONE_TINT = 0xd8cdb8;

export interface CarnageMark {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly fragments: Phaser.GameObjects.Sprite[];
  spawnMs: number;
}

export interface CarnageAppearance {
  defId?: string;
  targetKind?: "player" | "enemy";
}

export function drawCarnageStreaks(
  graphics: Phaser.GameObjects.Graphics,
  count: number,
  intensity: number,
  tint: number,
  worldX: number,
  worldY: number,
  impactAngle?: number,
): void {
  const directional = impactAngle === undefined
    ? undefined
    : screenAngle(worldX, worldY, impactAngle);
  for (let index = 0; index < count; index++) {
    const angle = directional !== undefined && index < Math.ceil(count * 0.65)
      ? directional + (Math.random() - 0.5) * 1.25
      : Math.random() * Math.PI * 2;
    const start = 5 + Math.random() * 5;
    const length = (18 + Math.random() * 38) * intensity;
    const width = (1.2 + Math.random() * 2.8) * Math.min(intensity, 1.5);
    const end = start + length;
    graphics.lineStyle(width, tint, 0.72 + Math.random() * 0.2);
    graphics.beginPath();
    graphics.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
    graphics.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
    graphics.strokePath();
    graphics.fillStyle(tint, 0.72);
    graphics.fillCircle(
      Math.cos(angle) * (end + 2 + Math.random() * 6),
      Math.sin(angle) * (end + 2 + Math.random() * 6),
      1.5 + Math.random() * 2.5,
    );
  }
}

export function drawCarnageChunks(
  scene: Phaser.Scene,
  mark: CarnageMark,
  count: number,
  intensity: number,
  appearance: CarnageAppearance,
  screenX: number,
  screenY: number,
  spritePrefix?: string,
): void {
  resetFragments(mark.fragments);
  const bones = isBoneAppearance(appearance);
  const frame = resolveFragmentFrame(scene, appearance, spritePrefix);
  const radius = 18 + 18 * intensity;
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = (7 + Math.random() * radius) * intensity;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const size = (2.5 + Math.random() * 4.5) * Math.min(intensity, 1.6);
    if (bones) drawBone(mark.graphics, x, y, angle, size);
    else if (frame !== undefined) {
      placeSpriteFragment(
        scene, mark, index, frame, screenX + x, screenY + y, intensity,
      );
    }
  }
}

function resetFragments(fragments: readonly Phaser.GameObjects.Sprite[]): void {
  for (const fragment of fragments) {
    fragment.setActive(false).setVisible(false);
  }
}

function isBoneAppearance(appearance: CarnageAppearance): boolean {
  return appearance.defId === "skeleton" || appearance.defId === "warden-of-five";
}

function resolveFragmentFrame(
  scene: Phaser.Scene,
  appearance: CarnageAppearance,
  spritePrefix?: string,
): string | number | undefined {
  const prefix = spritePrefix ??
    (appearance.defId ? monsterSpriteFor(appearance.defId) : undefined);
  return prefix
    ? scene.anims.get(`${prefix}_idle`)?.frames[0]?.textureFrame
    : undefined;
}

function drawBone(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  size: number,
): void {
  graphics.lineStyle(Math.max(2, size * 0.45), BONE_TINT, 0.9);
  graphics.beginPath();
  graphics.moveTo(
    x - Math.cos(angle) * size,
    y - Math.sin(angle) * size,
  );
  graphics.lineTo(
    x + Math.cos(angle) * size,
    y + Math.sin(angle) * size,
  );
  graphics.strokePath();
}

function placeSpriteFragment(
  scene: Phaser.Scene,
  mark: CarnageMark,
  index: number,
  frame: string | number,
  x: number,
  y: number,
  intensity: number,
): void {
  const fragment = mark.fragments[index] ?? growFragment(scene, mark);
  fragment.setFrame(frame);
  const width = fragment.frame.realWidth;
  const height = fragment.frame.realHeight;
  const cropWidth = Math.max(3, Math.floor(width * (0.22 + Math.random() * 0.28)));
  const cropHeight = Math.max(3, Math.floor(height * (0.18 + Math.random() * 0.25)));
  const cropX = Math.floor(Math.random() * Math.max(1, width - cropWidth + 1));
  const cropY = Math.floor(Math.random() * Math.max(1, height - cropHeight + 1));
  fragment
    .setCrop(cropX, cropY, cropWidth, cropHeight)
    .setPosition(x, y)
    .setScale(
      WORLD_PIXEL_SCALE *
      (0.72 + Math.random() * 0.48) *
      Math.min(intensity, 1.45),
    )
    .setAngle(Math.random() * 360)
    .setFlipX(Math.random() < 0.5)
    .clearTint()
    .setAlpha(BASE_ALPHA)
    .setActive(true)
    .setVisible(true);
}

function growFragment(
  scene: Phaser.Scene,
  mark: CarnageMark,
): Phaser.GameObjects.Sprite {
  const fragment = scene.add
    .sprite(0, 0, ASSET_KEYS.atlas)
    .setName("gore-sprite-fragment")
    .setOrigin(0.5)
    .setActive(false)
    .setVisible(false);
  mark.fragments.push(fragment);
  return fragment;
}

function screenAngle(worldX: number, worldY: number, worldAngle: number): number {
  const origin = worldToScreen(worldX, worldY);
  const endpoint = worldToScreen(
    worldX + Math.cos(worldAngle),
    worldY + Math.sin(worldAngle),
  );
  return Math.atan2(endpoint.y - origin.y, endpoint.x - origin.x);
}
