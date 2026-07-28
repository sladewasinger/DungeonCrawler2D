/**
 * Owns the four centered "window" widgets (inventory/contacts/craft/stash) as one
 * sub-facade — split out of index.ts's HudWidgets to stay under the file-size cap.
 * These four share one shape (toggle/open/close/isOpen/hitTestPanel/update/resize)
 * because they're all WidgetRegistry center-anchored panels in the same panel
 * language (HUD_OS.md §5's Phase 1 pattern).
 */
import type Phaser from "phaser";
import type { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { noopInventoryActions, noopSocialActions, noopStationActions, type SocialActions, type StationActions } from "../core/actionBundles.js";
import type { ContactData } from "../social/contactRows.js";
import { ContactsWindowWidget } from "../social/contactsWindow.js";
import { CraftWindowWidget } from "./craftWindow.js";
import type { CraftSnapshot, InventoryRowData, StashSnapshot, ToastData } from "../core/fakeData.js";
import { InventoryWindowWidget, type InventoryActions } from "../inventory/inventoryWindow.js";
import { StashWindowWidget } from "./stashWindow.js";

/**
 * Pure decision for the touch "tap outside a window closes it" sweep (HudWidgets.hitTest):
 * only touch has no [Esc], and only once something's actually open is there anything to
 * dismiss — kept standalone so the decision itself is unit-testable without a Phaser scene.
 */
export function shouldDismissOnOutsideTap(touchActive: boolean, anyWindowOpen: boolean): boolean {
  return touchActive && anyWindowOpen;
}

interface PanelWindowsOptions { scene: Phaser.Scene; registry: WidgetRegistry; viewport: Viewport; actions?: InventoryActions; social?: SocialActions; stations?: StationActions; }
interface PanelWindowsUpdate { inventory: readonly InventoryRowData[]; weaponId: string | null; contacts: readonly ContactData[]; craft: CraftSnapshot; stash: StashSnapshot; lastToast: ToastData | null; nowMs: number; }

export class PanelWindows {
  private readonly inventory: InventoryWindowWidget;
  private readonly contacts: ContactsWindowWidget;
  private readonly craft: CraftWindowWidget;
  private readonly stash: StashWindowWidget;

  constructor({ scene, registry, viewport, actions, social, stations }: PanelWindowsOptions) {
    const socialActions = social ?? noopSocialActions();
    const stationActions = stations ?? noopStationActions();
    this.inventory = new InventoryWindowWidget({ scene, registry, viewport, actions: actions ?? noopInventoryActions() });
    this.contacts = new ContactsWindowWidget({ scene, registry, viewport, actions: socialActions.contacts });
    this.craft = new CraftWindowWidget({ scene, registry, viewport, actions: stationActions.craft });
    this.stash = new StashWindowWidget({ scene, registry, viewport, actions: stationActions.stash });
  }

  update({ inventory, weaponId, contacts, craft, stash, lastToast, nowMs }: PanelWindowsUpdate): void {
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

  /** [E] near a stash opens it if not already open; it never toggles closed. */
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

  /** True while any of the four windows is open — gates the touch "tap outside closes it" sweep. */
  anyOpen(): boolean {
    return this.inventory.isOpen() || this.contacts.isOpen() || this.craft.isOpen() || this.stash.isOpen();
  }

  /** Closes every open window — a touch tap outside all of them (HudWidgets.hitTest). */
  closeAll(): void {
    this.inventory.close();
    this.contacts.close();
    this.craft.close();
    this.stash.close();
  }
}
