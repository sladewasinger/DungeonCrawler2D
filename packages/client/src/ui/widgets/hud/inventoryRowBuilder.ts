/**
 * Pure Phaser construction for one inventory row (icon, name, flavor line, Equip/Drop
 * buttons, selection accent) — split out of inventoryWindow.ts to stay under the
 * file-size cap. Every builder here just creates+positions objects; inventoryWindow.ts
 * owns the row's lifecycle (destroy on rebuild) and its click handlers' targets.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawSelectionAccent, PANEL_BORDER, PANEL_FILL } from "../../panel.js";
import type { InventoryRowView } from "./inventoryRows.js";
import { createItemIcon } from "./itemIcon.js";

const BTN_HEIGHT = 18;
const DROP_WIDTH = 42;
const EQUIP_WIDTH = 48;
const BTN_GAP = 4;
const NAME_LINE_Y_OFFSET = -6;
const FLAVOR_LINE_Y_OFFSET = 8;
const FLAVOR_COLOR = "#6b6b7e";

export interface RowBuilderContext {
  readonly scene: Phaser.Scene;
  readonly scale: number;
  readonly iconSize: number;
  readonly rowHeight: number;
  readonly currentWeaponId: string | null;
  readonly selectedItemId: string | null;
  onSelect(itemId: string): void;
  onEquip(itemId: string): void;
  onDrop(itemId: string): void;
}

/** Builds one row's full object set at local y, left..right — caller adds them to its panel container. */
export function buildInventoryRow(ctx: RowBuilderContext, view: InventoryRowView, left: number, right: number, y: number): Phaser.GameObjects.GameObject[] {
  const height = ctx.rowHeight - 2;
  const rowBg = ctx.scene.add.rectangle(left, y, right - left, height, PANEL_FILL, 0.4).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  rowBg.on("pointerdown", () => ctx.onSelect(view.itemId));
  const icon = createItemIcon(ctx.scene, view.itemId, ctx.iconSize, ctx.scale).setPosition(left + ctx.iconSize / 2 + 4, y + height / 2);
  const labels = buildRowLabels(ctx, view, left, y, height);
  const buttons = buildRowButtons(ctx, view, right, y, height);
  // Drawn LAST (on top of the buttons) — Epic 7.13's z-order fix (inventoryWindow.ts's history).
  const accent = drawSelectionAccent(ctx.scene, right - left, height).setPosition(left, y).setVisible(view.itemId === ctx.selectedItemId);
  return [rowBg, icon, ...labels, ...buttons, accent];
}

/** Name (+ hotbar tag) on one line, dimmed flavor line beneath — Epic 7.14 §4. */
function buildRowLabels(ctx: RowBuilderContext, view: InventoryRowView, left: number, y: number, height: number): Phaser.GameObjects.Text[] {
  const tag = view.boundSlot !== null ? `  [${view.boundSlot + 1}]` : "";
  const x = left + ctx.iconSize + 12;
  const nameLabel = ctx.scene.add
    .text(x, y + height / 2 + (view.flavor ? NAME_LINE_Y_OFFSET : 0), `${view.name} ×${view.qty}${tag}`, uiTextStyle(11, undefined, ctx.scale))
    .setOrigin(0, 0.5);
  if (!view.flavor) return [nameLabel];
  const flavorLabel = ctx.scene.add
    .text(x, y + height / 2 + FLAVOR_LINE_Y_OFFSET, view.flavor, uiTextStyle(9, FLAVOR_COLOR, ctx.scale))
    .setOrigin(0, 0.5);
  return [nameLabel, flavorLabel];
}

function buildRowButtons(ctx: RowBuilderContext, view: InventoryRowView, right: number, y: number, height: number): Phaser.GameObjects.GameObject[] {
  const btnY = y + (height - BTN_HEIGHT) / 2;
  const dropX = right - DROP_WIDTH;
  const drop = buildButton(ctx, dropX, btnY, DROP_WIDTH, "Drop", true, () => ctx.onDrop(view.itemId));
  if (!view.isWeapon) return drop;
  const equippedHere = ctx.currentWeaponId === view.itemId;
  const equipX = dropX - BTN_GAP - EQUIP_WIDTH;
  const equip = buildButton(ctx, equipX, btnY, EQUIP_WIDTH, equippedHere ? "Equipped" : "Equip", !equippedHere, () => ctx.onEquip(view.itemId));
  return [...equip, ...drop];
}

function buildButton(ctx: RowBuilderContext, x: number, y: number, width: number, label: string, active: boolean, onClick: () => void): Phaser.GameObjects.GameObject[] {
  const bg = ctx.scene.add.rectangle(x, y, width, BTN_HEIGHT, PANEL_FILL, 0.9).setOrigin(0, 0).setStrokeStyle(1, PANEL_BORDER);
  const text = ctx.scene.add
    .text(x + width / 2, y + BTN_HEIGHT / 2, label, uiTextStyle(9, active ? "#e8e8e8" : "#6b6b7e", ctx.scale))
    .setOrigin(0.5, 0.5);
  if (active) {
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", onClick);
  }
  return [bg, text];
}
