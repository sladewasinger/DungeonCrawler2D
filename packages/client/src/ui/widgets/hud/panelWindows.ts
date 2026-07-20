/**
 * Owns the four centered "window" widgets (inventory/contacts/craft/stash) as one
 * sub-facade — split out of index.ts's HudWidgets to stay under the file-size cap.
 * These four share one shape (toggle/open/close/isOpen/hitTestPanel/update/resize)
 * because they're all WidgetRegistry center-anchored panels in the same panel
 * language (HUD_OS.md §5's Phase 1 pattern).
 */
import type Phaser from "phaser";
import type { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { noopInventoryActions, noopSocialActions, noopStationActions, type SocialActions, type StationActions } from "./actionBundles.js";
import type { ContactData } from "./contactRows.js";
import { ContactsWindowWidget } from "./contactsWindow.js";
import { CraftWindowWidget } from "./craftWindow.js";
import type { CraftSnapshot, InventoryRowData, StashSnapshot, ToastData } from "./fakeData.js";
import { InventoryWindowWidget, type InventoryActions } from "./inventoryWindow.js";
import { StashWindowWidget } from "./stashWindow.js";

export class PanelWindows {
  private readonly inventory: InventoryWindowWidget;
  private readonly contacts: ContactsWindowWidget;
  private readonly craft: CraftWindowWidget;
  private readonly stash: StashWindowWidget;

  constructor(
    scene: Phaser.Scene,
    registry: WidgetRegistry,
    viewport: Viewport,
    actions?: InventoryActions,
    social?: SocialActions,
    stations?: StationActions,
  ) {
    const socialActions = social ?? noopSocialActions();
    const stationActions = stations ?? noopStationActions();
    this.inventory = new InventoryWindowWidget(scene, registry, viewport, actions ?? noopInventoryActions());
    this.contacts = new ContactsWindowWidget(scene, registry, viewport, socialActions.contacts);
    this.craft = new CraftWindowWidget(scene, registry, viewport, stationActions.craft);
    this.stash = new StashWindowWidget(scene, registry, viewport, stationActions.stash);
  }

  update(
    inventory: readonly InventoryRowData[],
    weaponId: string | null,
    contacts: readonly ContactData[],
    craft: CraftSnapshot,
    stash: StashSnapshot,
    lastToast: ToastData | null,
    nowMs: number,
  ): void {
    this.inventory.update(inventory, weaponId);
    this.contacts.update(contacts);
    this.craft.update(craft, lastToast, nowMs);
    this.stash.update(stash, lastToast, nowMs);
  }

  resize(registry: WidgetRegistry, viewport: Viewport): void {
    this.inventory.resize(registry, viewport);
    this.contacts.resize(registry, viewport);
    this.craft.resize(registry, viewport);
    this.stash.resize(registry, viewport);
  }

  toggleInventory(): void {
    this.inventory.toggle();
  }

  closeInventory(): void {
    this.inventory.close();
  }

  inventoryOpen(): boolean {
    return this.inventory.isOpen();
  }

  selectedInventoryItem(): string | null {
    return this.inventory.selectedItem();
  }

  toggleContacts(): void {
    this.contacts.toggle();
  }

  closeContacts(): void {
    this.contacts.close();
  }

  craftOpen(): boolean {
    return this.craft.isOpen();
  }

  toggleCraft(): void {
    this.craft.toggle();
  }

  closeCraft(): void {
    this.craft.close();
  }

  stashOpen(): boolean {
    return this.stash.isOpen();
  }

  /** [E] near a stash opens it if not already open — never toggles closed (matches v1). */
  openStash(): void {
    this.stash.openIfClosed();
  }

  closeStash(): void {
    this.stash.close();
  }

  /** Which window (if any) owns a screen point, for HudWidgets.hitTest()'s shared dispatch. */
  hitTest(screenX: number, screenY: number): string | null {
    if (this.inventory.hitTestPanel(screenX, screenY)) return "window:inventory";
    if (this.contacts.hitTestPanel(screenX, screenY)) return "window:contacts";
    if (this.craft.hitTestPanel(screenX, screenY)) return "window:craft";
    if (this.stash.hitTestPanel(screenX, screenY)) return "window:stash";
    return null;
  }
}
