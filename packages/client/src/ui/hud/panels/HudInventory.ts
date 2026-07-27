/** Owns the shared inventory workspace state and authoritative item actions. */
import type { Connection } from "../../../net/connection/connection.js";
import { inventoryRows } from "../model/HudModel.js";
import {
  createInventoryShell,
  type InventoryFolder,
  type InventoryTab,
} from "../inventory/InventoryShell.js";
import { createInventoryRow } from "../inventory/InventoryRows.js";

export class HudInventory {
  private readonly shell;
  readonly element;
  private selectedTab: InventoryTab = "all";
  private selectedFolder: InventoryFolder = "all";
  private signature = "";

  constructor(
    private readonly connection: Connection,
    close: () => void,
    private readonly touchDevice: boolean,
  ) {
    this.shell = createInventoryShell({
      close,
      selectTab: (tab) => {
        this.selectedTab = tab;
        this.invalidate();
      },
      selectFolder: (folder) => {
        this.selectedFolder = folder;
        this.invalidate();
      },
      search: () => this.invalidate(),
    });
    this.element = this.shell.element;
  }

  open(): void {
    this.element.hidden = false;
    this.element.style.display = "grid";
    this.invalidate();
    // Do not summon the mobile keyboard just for opening the inventory. The
    // player can still tap the filter field when they actually want to type.
    if (this.touchDevice) return;
    this.shell.search.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (this.isOpen()) this.shell.search.focus({ preventScroll: true });
    });
  }

  close(): void {
    this.element.hidden = true;
    this.element.style.display = "none";
    this.shell.search.blur();
  }

  isOpen(): boolean {
    return this.element.style.display !== "none";
  }

  toggle(focusGame: () => void): void {
    if (this.isOpen()) this.closeAndFocus(focusGame);
    else {
      this.open();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  closeAndFocus(focusGame: () => void): void {
    if (!this.isOpen()) return;
    this.close();
    focusGame();
  }

  update(): void {
    if (!this.isOpen()) return;
    const signature = JSON.stringify([
      this.connection.inventory,
      this.connection.hotbar,
      this.connection.weapon,
      this.selectedTab,
      this.selectedFolder,
      this.shell.search.value,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    const rows = this.visibleRows();
    this.shell.summary.textContent =
      `${rows.length} of ${this.connection.inventory.length} stacks`;
    this.shell.list.replaceChildren(
      ...rows.map((row) => createInventoryRow(this.connection, row)),
    );
    this.syncNavigation();
  }

  private visibleRows(): ReturnType<typeof inventoryRows> {
    const query = this.shell.search.value.trim().toLocaleLowerCase();
    return inventoryRows(this.connection.inventory, this.connection.hotbar)
      .filter((row) =>
        this.selectedTab === "all" || row.category === this.selectedTab)
      .filter((row) =>
        this.selectedFolder === "all" ||
        (this.selectedFolder === "equipped" &&
          row.id === this.connection.weapon) ||
        (this.selectedFolder === "hotbar" && row.boundSlot !== null))
      .filter((row) =>
        !query ||
        row.name.toLocaleLowerCase().includes(query) ||
        row.flavor?.toLocaleLowerCase().includes(query));
  }

  private syncNavigation(): void {
    this.syncSelected(
      this.shell.tabs,
      "inventoryTab",
      this.selectedTab,
    );
    this.syncSelected(
      this.shell.folders,
      "inventoryFolder",
      this.selectedFolder,
    );
  }

  private syncSelected(
    parent: HTMLElement,
    key: "inventoryTab" | "inventoryFolder",
    selected: string,
  ): void {
    for (const element of parent.children) {
      const button = element as HTMLButtonElement;
      const active = button.dataset[key] === selected;
      button.dataset.selected = String(active);
    }
  }

  private invalidate(): void {
    this.signature = "";
    this.update();
  }

}
