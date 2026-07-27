import Phaser from "phaser";
import {
  ASSET_KEYS,
  WORLD_PIXEL_SCALE,
} from "../boot/assetManifest.js";
import { monsterSpriteFor } from "../render/entities/spriteMap.js";
import { drawCarnageStreak, screenAngle } from "./deathCarnageStreak.js";

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

interface CarnageStreakInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly count: number;
  readonly intensity: number;
  readonly tint: number;
  readonly world: { x: number; y: number };
  readonly impactAngle?: number | undefined;
}

interface CarnageChunkInput {
  readonly scene: Phaser.Scene;
  readonly mark: CarnageMark;
  readonly count: number;
  readonly intensity: number;
  readonly appearance: CarnageAppearance;
  readonly screen: { x: number; y: number };
  readonly spritePrefix?: string | undefined;
}

interface BoneInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly position: { x: number; y: number };
  readonly angle: number;
  readonly size: number;
}

interface SpriteFragmentInput {
  readonly scene: Phaser.Scene;
  readonly mark: CarnageMark;
  readonly index: number;
  readonly frame: string | number;
  readonly position: { x: number; y: number };
  readonly intensity: number;
}

export function drawCarnageStreaks({ graphics, count, intensity, tint, world, impactAngle }: CarnageStreakInput): void {
  const directional = impactAngle === undefined
    ? undefined
    : screenAngle(world.x, world.y, impactAngle);
  for (let index = 0; index < count; index++) {
    drawCarnageStreak({ graphics, count, intensity, tint, directional, index });
  }
}


export function drawCarnageChunks({ scene, mark, count, intensity, appearance, screen, spritePrefix }: CarnageChunkInput): void {
  resetFragments(mark.fragments);
  const bones = isBoneAppearance(appearance);
  const frame = resolveFragmentFrame(scene, appearance, spritePrefix);
  const radius = 18 + 18 * intensity;
  for (let index = 0; index < count; index++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = (7 + Math.random() * radius) * intensity;
    const position = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    const size = (2.5 + Math.random() * 4.5) * Math.min(intensity, 1.6);
    if (bones) drawBone({ graphics: mark.graphics, position, angle, size });
    else if (frame !== undefined) {
      placeSpriteFragment({ scene, mark, index, frame, position: { x: screen.x + position.x, y: screen.y + position.y }, intensity });
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

function drawBone({ graphics, position, angle, size }: BoneInput): void {
  const { x, y } = position;
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

function placeSpriteFragment({ scene, mark, index, frame, position, intensity }: SpriteFragmentInput): void {
  const { x, y } = position;
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
