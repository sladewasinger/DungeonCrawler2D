import type Phaser from "phaser";
import type { AttackCooldownState } from "./attackCooldown.js";

export const ATTACK_COOLDOWN_BAR_WIDTH_PX = 30;
export const ATTACK_COOLDOWN_BAR_HEIGHT_PX = 5;
export const ATTACK_COOLDOWN_BAR_OFFSET_Y_PX = 5;

const BOW_CHARGE_BAR_WIDTH_PX = 32;
const BOW_CHARGE_BAR_HEIGHT_PX = 5;
const BOW_CHARGE_HEAD_GAP_PX = 8;

const BAR_BORDER_PX = 1;
const BAR_BACKGROUND_COLOR = 0x15121d;
const BAR_FILL_COLOR = 0xffb43d;
const BAR_RIM_COLOR = 0xfff1cf;
const BOW_MIN_COLOR = 0xf59e0b;
const BOW_MAX_COLOR = 0x22c55e;

export interface AttackCooldownIndicatorUpdate {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly state: AttackCooldownState;
  readonly x: number;
  readonly feetY: number;
  readonly headY?: number;
  readonly bowChargeRatio?: number | null;
  readonly depth: number;
  readonly blocking: boolean;
  readonly downed: boolean;
}

export function createAttackCooldownIndicator(
  scene: Phaser.Scene,
): Phaser.GameObjects.Graphics {
  return scene.add.graphics();
}

/** Draws bow charge above the head or melee recovery below feet. */
export function updateAttackCooldownIndicator(
  input: AttackCooldownIndicatorUpdate,
): void {
  const { graphics, state, bowChargeRatio } = input;
  if (input.blocking || input.downed) {
    graphics.clear().setVisible(false);
    return;
  }
  if (bowChargeRatio !== null && bowChargeRatio !== undefined) {
    drawBowChargeBar(input, bowChargeRatio);
    graphics.setDepth(input.depth).setVisible(true);
    return;
  }
  if (state.ready) {
    graphics.clear().setVisible(false);
    return;
  }
  drawCooldownBar(input);
  graphics.setDepth(input.depth).setVisible(true);
}

interface HorizontalBarSpec {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly progress: number;
  readonly fillColor: number;
}

function drawCooldownBar(input: AttackCooldownIndicatorUpdate): void {
  drawHorizontalBar(input.graphics, {
    left: input.x - ATTACK_COOLDOWN_BAR_WIDTH_PX / 2,
    top: input.feetY + ATTACK_COOLDOWN_BAR_OFFSET_Y_PX,
    width: ATTACK_COOLDOWN_BAR_WIDTH_PX,
    height: ATTACK_COOLDOWN_BAR_HEIGHT_PX,
    progress: clampUnit(input.state.progress),
    fillColor: BAR_FILL_COLOR,
  });
}

function drawBowChargeBar(input: AttackCooldownIndicatorUpdate, ratio: number): void {
  const clamped = clampUnit(ratio);
  const t = clampUnit((clamped - 0.2) / 0.8);
  drawHorizontalBar(input.graphics, {
    left: input.x - BOW_CHARGE_BAR_WIDTH_PX / 2,
    top: (input.headY ?? input.feetY - 32) - BOW_CHARGE_HEAD_GAP_PX,
    width: BOW_CHARGE_BAR_WIDTH_PX,
    height: BOW_CHARGE_BAR_HEIGHT_PX,
    progress: clamped,
    fillColor: interpolateRgb(BOW_MIN_COLOR, BOW_MAX_COLOR, t),
  });
}

function drawHorizontalBar(graphics: Phaser.GameObjects.Graphics, bar: HorizontalBarSpec): void {
  graphics.clear();
  graphics.fillStyle(BAR_BACKGROUND_COLOR, 0.92);
  graphics.fillRect(
    bar.left - BAR_BORDER_PX,
    bar.top - BAR_BORDER_PX,
    bar.width + BAR_BORDER_PX * 2,
    bar.height + BAR_BORDER_PX * 2,
  );
  graphics.fillStyle(bar.fillColor, 1);
  graphics.fillRect(bar.left, bar.top, bar.width * bar.progress, bar.height);
  graphics.lineStyle(BAR_BORDER_PX, BAR_RIM_COLOR, 0.95);
  graphics.strokeRect(
    bar.left - BAR_BORDER_PX,
    bar.top - BAR_BORDER_PX,
    bar.width + BAR_BORDER_PX * 2,
    bar.height + BAR_BORDER_PX * 2,
  );
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function interpolateRgb(from: number, to: number, t: number): number {
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const r = Math.round(fr + (((to >> 16) & 0xff) - fr) * t);
  const g = Math.round(fg + (((to >> 8) & 0xff) - fg) * t);
  const b = Math.round(fb + ((to & 0xff) - fb) * t);
  return (r << 16) | (g << 8) | b;
}
