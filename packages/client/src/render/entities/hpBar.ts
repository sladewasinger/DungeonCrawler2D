// Micro HP bar: a chunky 2-piece (bg + fill) bar floating above an entity — the mini
// version of VISUAL_DIRECTION's "chunky, segmented, readable at a glance" health bars.
import type Phaser from "phaser";

const BAR_WIDTH = 36;
const BAR_HEIGHT = 7;
const BG_COLOR = 0x14141c;
const FILL_COLOR = 0xe04a4a; // blood/damage accent doubles as the low-hp read
const BORDER_COLOR = 0x494956;
const Y_OFFSET = -10;

export interface HpBar {
  readonly container: Phaser.GameObjects.Container;
  readonly fill: Phaser.GameObjects.Rectangle;
}

export function createHpBar(scene: Phaser.Scene, depth: number): HpBar {
  const bg = scene.add.rectangle(0, 0, BAR_WIDTH, BAR_HEIGHT, BG_COLOR).setStrokeStyle(1, BORDER_COLOR);
  const fill = scene.add.rectangle(-BAR_WIDTH / 2, 0, BAR_WIDTH, BAR_HEIGHT, FILL_COLOR).setOrigin(0, 0.5);
  const container = scene.add.container(0, 0, [bg, fill]).setDepth(depth);
  return { container, fill };
}

/** Repositions the bar above an entity's head and resizes its fill to hp/maxHp. */
export function updateHpBar(bar: HpBar, headScreenX: number, headScreenY: number, hp: number, maxHp: number): void {
  bar.container.setPosition(headScreenX, headScreenY + Y_OFFSET);
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  bar.fill.width = BAR_WIDTH * ratio;
}
