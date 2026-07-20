/**
 * Contacts window HUD widget (Epic 7.10): registry id "contacts" — a defaults-off
 * fixed panel listing mutual contacts (online first, then alphabetical, per
 * contactRows.ts), each row with a DM button that prefills the chat input.
 * Mirrors inventoryWindow.ts's Phase 1 pattern: real interactive Phaser objects,
 * not routed through HudWidgets.hitTest()'s string-tag dispatch.
 */
import type Phaser from "phaser";
import { uiTextStyle } from "../../font.js";
import { drawPanelBackground, PANEL_BORDER, PANEL_FILL, spacing } from "../../panel.js";
import { createWidgetContainer, syncWidgetContainer } from "../container.js";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { contactRowViews, type ContactData, type ContactRowView } from "./contactRows.js";

const WIDGET_ID = "contacts";
const PANEL_WIDTH = 220;
const PANEL_HEIGHT = 260;
const TITLE_HEIGHT = 24;
const ROW_HEIGHT = 28;
const DM_WIDTH = 40;
const DM_HEIGHT = 18;
const MAX_VISIBLE_ROWS = Math.floor((PANEL_HEIGHT - TITLE_HEIGHT - spacing(2)) / ROW_HEIGHT);

/** Prefills the chat input with "/dm <name> " and focuses it — threaded from HudScene. */
export interface ContactsActions {
  startDm(name: string): void;
}

export class ContactsWindowWidget {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly actions: ContactsActions;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private open = false;
  /** null = "never rendered yet" — distinct from "", which a genuinely empty contact
   * list also signs as, so an empty-handed first render isn't silently skipped. */
  private lastSignature: string | null = null;

  constructor(scene: Phaser.Scene, registry: WidgetRegistry, viewport: Viewport, actions: ContactsActions) {
    this.scene = scene;
    this.actions = actions;
    registry.register({
      id: WIDGET_ID,
      defaultAnchor: "center",
      defaultOffset: { x: 0, y: 0 },
      defaultScale: 1,
      // The registry's `visible` governs whether this widget's container is live in the
      // HUD layout at all (container.ts's syncWidgetContainer applies it unconditionally,
      // on construction and every resize) — it is NOT the open/closed state. Must stay
      // true, exactly like inventoryWindow.ts's Phase 1 pattern this widget mirrors, or
      // toggle()/openWindow()'s own `this.panel.setVisible(...)` below can never show
      // anything: a `false` here would keep the outer container hidden forever, since
      // there's no Phase 2 edit-HUD catalog yet to flip it back on (docs/ROADMAP.md
      // Epic 7.10's "defaults off" bullet refers to that future catalog entry, not this).
      // Closed-by-default is `this.open = false` below, same as inventory.
      defaultVisible: true,
    });
    const layout = registry.resolve(viewport).get(WIDGET_ID)!;
    this.container = createWidgetContainer(scene, layout);
    this.panel = scene.add.container(0, 0);
    this.container.add(this.panel);
    const bg = drawPanelBackground(scene, PANEL_WIDTH, PANEL_HEIGHT).setPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
    this.hitArea = scene.add
      .rectangle(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2, PANEL_WIDTH, PANEL_HEIGHT, 0x000000, 0)
      .setOrigin(0, 0);
    const title = scene.add
      .text(0, -PANEL_HEIGHT / 2 + TITLE_HEIGHT / 2, "CONTACTS", uiTextStyle(12))
      .setOrigin(0.5, 0.5);
    this.panel.add([bg, this.hitArea, title]);
    this.panel.setVisible(false);
  }

  private rebuildRows(views: ContactRowView[]): void {
    for (const obj of this.rowObjects) obj.destroy();
    this.rowObjects = [];
    const top = -PANEL_HEIGHT / 2 + TITLE_HEIGHT + spacing(1);
    if (views.length === 0) {
      const empty = this.scene.add
        .text(0, top + spacing(2), "No contacts yet — hold F near someone", uiTextStyle(10, "#6b6b7e"))
        .setOrigin(0.5, 0);
      this.panel.add(empty);
      this.rowObjects.push(empty);
      return;
    }
    views.slice(0, MAX_VISIBLE_ROWS).forEach((view, index) => {
      this.rowObjects.push(...this.buildRow(view, top + index * ROW_HEIGHT));
    });
  }

  private buildRow(view: ContactRowView, y: number): Phaser.GameObjects.GameObject[] {
    const left = -PANEL_WIDTH / 2 + spacing(1);
    const right = PANEL_WIDTH / 2 - spacing(1);
    const dot = this.scene.add.circle(left + 4, y + ROW_HEIGHT / 2, 3, view.online ? 0x4ade80 : 0x6b6b7e);
    const label = this.scene.add
      .text(left + 14, y + ROW_HEIGHT / 2, view.name, uiTextStyle(11))
      .setOrigin(0, 0.5);
    const dmBtn = this.buildDmButton(view.name, right - DM_WIDTH, y + (ROW_HEIGHT - DM_HEIGHT) / 2);
    const objects = [dot, label, ...dmBtn];
    this.panel.add(objects);
    return objects;
  }

  private buildDmButton(name: string, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add
      .rectangle(x, y, DM_WIDTH, DM_HEIGHT, PANEL_FILL, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.actions.startDm(name));
    const text = this.scene.add.text(x + DM_WIDTH / 2, y + DM_HEIGHT / 2, "DM", uiTextStyle(9)).setOrigin(0.5, 0.5);
    return [bg, text];
  }

  /** Drives the row list — cheap no-op when nothing changed and the panel is closed. */
  update(contacts: readonly ContactData[]): void {
    if (!this.open) return;
    const signature = contacts.map((c) => `${c.name}:${c.online}`).join(",");
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.rebuildRows(contactRowViews(contacts));
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
    this.lastSignature = null; // force a fresh render of whatever the last snapshot held
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
