/** Owns the shared inventory workspace state and authoritative item actions. */
import type { Connection } from "../../../net/connection/connection.js";
import { buildInventoryWorkspace } from "../inventory/InventoryGrid.js";
import { isCraftingTableNearby } from "../inventory/InventoryQuickCraft.js";
import { createInventoryShell } from "../inventory/InventoryShell.js";
import { hotbarQuantity, inventoryRows, type InventoryRow } from "../model/HudModel.js";

export class HudInventory {
  private readonly shell;
  readonly element;
  private selectedItemId: string | null = null;
  private signature = "";

  constructor(
    private readonly connection: Connection,
    close: () => void,
  ) {
    this.shell = createInventoryShell({ close });
    this.element = this.shell.element;
    this.close();
  }

  open(): void {
    this.element.hidden = false;
    this.element.style.display = "grid";
    this.invalidate();
  }

  close(): void {
    this.element.hidden = true;
    this.element.style.display = "none";
    this.selectedItemId = null;
  }

  isOpen(): boolean {
    return !this.element.hidden;
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
    if (this.selectedItemId && hotbarQuantity(this.connection.inventory, this.selectedItemId) <= 0) {
      this.selectedItemId = null;
    }
    const signature = this.buildSignature();
    if (signature === this.signature) return;
    this.signature = signature;
    this.renderWorkspace();
  }

  private buildSignature(): string {
    return JSON.stringify([
      this.connection.inventory,
      this.connection.hotbar,
      this.connection.weapon,
      this.connection.armor,
      this.connection.hp,
      this.connection.maxHp,
      this.connection.stamina,
      this.connection.maxStamina,
      this.connection.charLevel,
      isCraftingTableNearby(this.connection),
      this.selectedItemId,
    ]);
  }

  private renderWorkspace(): void {
    const rows = this.backpackRows();
    const hotbarOccupied = this.connection.hotbar.filter(
      (id) => id !== null && hotbarQuantity(this.connection.inventory, id) > 0,
    ).length;
    this.shell.summary.textContent = `${rows.length} / 27 backpack · ${hotbarOccupied} / 9 hotbar`;
    this.shell.list.replaceChildren(
      buildInventoryWorkspace(this.connection, rows, {
        selectedItemId: this.selectedItemId,
        selectItem: (itemId) => {
          this.selectedItemId = itemId;
          this.invalidate();
        },
      }),
    );
  }

  private backpackRows(): InventoryRow[] {
    const hotbarItems = new Set(
      this.connection.hotbar.filter((id): id is string => Boolean(id)),
    );
    const wornCounts = this.wornArmorCounts();
    return inventoryRows(this.connection.inventory, this.connection.hotbar).filter((row) => {
      if (hotbarItems.has(row.id)) return false;
      return row.quantity > (wornCounts.get(row.id) ?? 0);
    });
  }

  private wornArmorCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const id of Object.values(this.connection.armor ?? {})) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }

  private invalidate(): void {
    this.signature = "";
    this.update();
  }
}
