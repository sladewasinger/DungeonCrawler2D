/**
 * Crafting window HUD widget (Epic 7.12): registry id "craft" — a fixed centered panel
 * listing every recipe with a have/need ingredient breakdown and a Craft button, active
 * only when every ingredient is met. Opens via [C] near a crafting table (input/index.ts,
 * gated in scenes/dungeon/panelAdapters.ts) and auto-closes the moment the snapshot
 * reports the table's no longer nearby, mirroring v1's Panels.sync walk-away close.
 * Mirrors inventoryWindow.ts's Phase 1 pattern: real interactive Phaser objects, not
 * routed through HudWidgets.hitTest()'s string-tag dispatch.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import type { CraftSnapshot, ToastData } from "./fakeData.js";
import { createItemIcon } from "./itemIcon.js";
import type { RecipeRowView } from "./recipeRows.js";

const WIDGET_ID = "craft";
const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 280;
const TITLE_HEIGHT = 24;
const ROW_HEIGHT = 40;
const ICON_SIZE = 24;
const CRAFT_BTN_WIDTH = 52;
const CRAFT_BTN_HEIGHT = 20;
const MET_COLOR = "#9fe8c9";
const UNMET_COLOR = "#e8846b";
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TITLE_HEIGHT - spacing(3)) / ROW_HEIGHT);

/** The one network intent this window drives — Connection.craft(recipeId). */
export interface CraftActions {
  craft(recipeId: string): void;
}

export class CraftWindowWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly actions: CraftActions;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private open = false;
  private lastSignature: string | null = null;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, actions: CraftActions) {
    this.scene = scene;
    this.actions = actions;
    registry.register({ id: WIDGET_ID, defaultAnchor: "center", defaultOffset: { x: 0, y: 0 }, defaultScale: 1, defaultVisible: true });
    // Registered synchronously above, so this id is always present in the resolved map.
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.panel = scene.add.container(0, 0);
    this.container.add(this.panel);
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
    this.hitArea = scene.add
      .rectangle(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0);
    const title = scene.add
      .text(0, -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2, "CRAFTING", uiTextStyle(12))
      .setOrigin(0.5, 0.5);
    this.footer = scene.add
      .text(0, PANEL_HEIGHT / 2 - spacing(1.5), "", uiTextStyle(10, "#c8ecf7"))
      .setOrigin(0.5, 1);
    this.panel.add([bg, this.hitArea, title, this.footer]);
    this.panel.setVisible(false);
  }

  private rebuildRows(recipes: readonly RecipeRowView[]): void {
    for (const obj of this.rowObjects) obj.destroy();
    this.rowObjects = [];
    const top = -PANEL_HEIGHT / 2 + TITLE_HEIGHT + spacing(1);
    recipes.slice(0, MAX_VISIBLE_ROWS).forEach((view, index) => {
      this.rowObjects.push(...this.buildRow(view, top + index * ROW_HEIGHT));
    });
  }

  private buildRow(view: RecipeRowView, y: number): Phaser.GameObjects.GameObject[] {
    const left = -PANEL_WIDTH / 2 + spacing(1);
    const right = PANEL_WIDTH / 2 - spacing(1);
    const rowBg = this.scene.add.rectangle(left, y, right - left, ROW_HEIGHT - 2, PANEL_FILL, 0.4).setOrigin(0, 0);
    const icon = createItemIcon(this.scene, view.outputId, ICON_SIZE).setPosition(left + ICON_SIZE / 2 + 4, y + ICON_SIZE / 2 + 4);
    const name = this.scene.add
      .text(left + ICON_SIZE + spacing(1.5), y + 6, `${view.outputName} ×${view.outputQty}`, uiTextStyle(11))
      .setOrigin(0, 0);
    const ingredients = this.scene.add
      .text(left + ICON_SIZE + spacing(1.5), y + 22, ingredientsLabel(view), uiTextStyle(9, view.craftable ? MET_COLOR : UNMET_COLOR))
      .setOrigin(0, 0);
    const button = this.buildCraftButton(view, right - CRAFT_BTN_WIDTH, y + (ROW_HEIGHT - 2 - CRAFT_BTN_HEIGHT) / 2);
    const objects = [rowBg, icon, name, ingredients, ...button];
    this.panel.add(objects);
    return objects;
  }

  private buildCraftButton(view: RecipeRowView, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add
      .rectangle(x, y, CRAFT_BTN_WIDTH, CRAFT_BTN_HEIGHT, PANEL_FILL, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER);
    const text = this.scene.add
      .text(x + CRAFT_BTN_WIDTH / 2, y + CRAFT_BTN_HEIGHT / 2, "Craft", uiTextStyle(10, view.craftable ? "#e8e8e8" : "#6b6b7e"))
      .setOrigin(0.5, 0.5);
    if (view.craftable) {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.actions.craft(view.recipeId));
    }
    return [bg, text];
  }

  /** Rebuilds rows on signature change; auto-closes the moment the crafting table falls out of range. */
  update(craft: CraftSnapshot, lastToast: ToastData | null, nowMs: number): void {
    if (!this.open) return;
    if (!craft.nearby) {
      this.close();
      return;
    }
    const toastText = lastToast && lastToast.until > nowMs ? lastToast.msg : "";
    const signature = `${toastText}|${craft.recipes.map((r) => `${r.recipeId}:${r.craftable}:${r.ingredients.map((i) => i.have).join(",")}`).join(";")}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.footer.setText(toastText);
    this.rebuildRows(craft.recipes);
  }

  toggle(): void {
    if (this.open) this.close();
    else this.openWindow();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.panel.setVisible(false);
  }

  private openWindow(): void {
    this.open = true;
    this.lastSignature = null;
    this.panel.setVisible(true);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Shared hit-claim convention (see inventoryWindow.ts's hitTestPanel doc comment). */
  hitTestPanel(screenX: number, screenY: number): boolean {
    return this.open && this.hitArea.getBounds().contains(screenX, screenY);
  }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    const layout = registry.resolve(viewport).get(WIDGET_ID);
    if (layout) syncWidgetContainer(this.container, layout);
  }
}

function ingredientsLabel(view: RecipeRowView): string {
  return view.ingredients.map((i) => `${i.need}× ${i.name} (${i.have}/${i.need})`).join("   ");
}
