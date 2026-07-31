import type Phaser from "phaser";
import type { AttackCooldownState } from "./attackCooldown.js";

export const ATTACK_COOLDOWN_BAR_WIDTH_PX = 30;
export const ATTACK_COOLDOWN_BAR_HEIGHT_PX = 5;
export const ATTACK_COOLDOWN_BAR_OFFSET_Y_PX = 5;

const BAR_BORDER_PX = 1;
const BAR_BACKGROUND_COLOR = 0x15121d;
const BAR_FILL_COLOR = 0xffb43d;
const BAR_RIM_COLOR = 0xfff1cf;

export interface AttackCooldownIndicatorUpdate {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly state: AttackCooldownState;
  readonly x: number;
  readonly feetY: number;
  readonly depth: number;
  readonly blocking: boolean;
  readonly downed: boolean;
}

export function createAttackCooldownIndicator(
  scene: Phaser.Scene,
): Phaser.GameObjects.Graphics {
  return scene.add.graphics();
}

/** Draws recovery as a compact horizontal fill, visually distinct from attack geometry. */
export function updateAttackCooldownIndicator(
  input: AttackCooldownIndicatorUpdate,
): void {
  const { graphics, state } = input;
  if (input.blocking || input.downed || state.ready) {
    graphics.clear().setVisible(false);
    return;
  }
  drawCooldownBar(input);
  graphics.setDepth(input.depth).setVisible(true);
}

function drawCooldownBar(input: AttackCooldownIndicatorUpdate): void {
  const { graphics } = input;
  const left = input.x - ATTACK_COOLDOWN_BAR_WIDTH_PX / 2;
  const top = input.feetY + ATTACK_COOLDOWN_BAR_OFFSET_Y_PX;
  const progress = Math.min(1, Math.max(0, input.state.progress));
  graphics.clear();
  graphics.fillStyle(BAR_BACKGROUND_COLOR, 0.92);
  graphics.fillRect(
    left - BAR_BORDER_PX,
    top - BAR_BORDER_PX,
    ATTACK_COOLDOWN_BAR_WIDTH_PX + BAR_BORDER_PX * 2,
    ATTACK_COOLDOWN_BAR_HEIGHT_PX + BAR_BORDER_PX * 2,
  );
  graphics.fillStyle(BAR_FILL_COLOR, 1);
  graphics.fillRect(
    left,
    top,
    ATTACK_COOLDOWN_BAR_WIDTH_PX * progress,
    ATTACK_COOLDOWN_BAR_HEIGHT_PX,
  );
  graphics.lineStyle(BAR_BORDER_PX, BAR_RIM_COLOR, 0.95);
  graphics.strokeRect(
    left - BAR_BORDER_PX,
    top - BAR_BORDER_PX,
    ATTACK_COOLDOWN_BAR_WIDTH_PX + BAR_BORDER_PX * 2,
    ATTACK_COOLDOWN_BAR_HEIGHT_PX + BAR_BORDER_PX * 2,
  );
}
