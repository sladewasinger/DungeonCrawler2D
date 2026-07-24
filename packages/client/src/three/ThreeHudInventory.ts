/** Owns the scrollable HTML inventory workspace and its authoritative actions. */
import type { Connection } from "../net/connection.js";
import { inventoryRows, nextAvailableHotbarSlot } from "./ThreeHudModel.js";
import { HUD_GOLD, HUD_MUTED, HUD_PANEL, createHudButton } from "./ThreeHudStyles.js";

type InventoryTab = "all" | "weapons" | "usables" | "materials";
const TABS: readonly InventoryTab[] = ["all", "weapons", "usables", "materials"];

export class ThreeHudInventory {
  readonly element = document.createElement("div");
  private readonly header = document.createElement("div");
  private readonly tabs = document.createElement("div");
  private readonly list = document.createElement("div");
  private selectedTab: InventoryTab = "all";
  private signature = "";

  constructor(
    private readonly connection: Connection,
    close: () => void,
  ) {
    this.element.style.cssText =
      `${HUD_PANEL};display:grid;grid-template-rows:auto 1fr;gap:7px`;
    this.header.style.cssText =
      "display:grid;grid-template-columns:1fr auto;gap:6px";
    this.tabs.style.cssText = "display:flex;gap:4px";
    this.list.style.cssText =
      "min-height:0;overflow-y:auto;overflow-x:hidden;display:grid;" +
      "align-content:start;gap:5px;scrollbar-color:#555a75 #171827";
    this.tabs.append(...TABS.map((tab) => this.createTab(tab)));
    const closeButton = createHudButton("close", close);
    closeButton.setAttribute("aria-label", "Close inventory");
    this.header.append(this.tabs, closeButton);
    this.element.append(this.header, this.list);
  }

  update(): void {
    const signature = JSON.stringify([
      this.connection.inventory,
      this.connection.hotbar,
      this.connection.weapon,
      this.selectedTab,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    const rows = inventoryRows(
      this.connection.inventory,
      this.connection.hotbar,
    ).filter((row) =>
      this.selectedTab === "all" || row.category === this.selectedTab
    );
    this.list.replaceChildren(...rows.map((row) => this.createRow(row)));
    this.syncTabs();
  }

  private createTab(tab: InventoryTab): HTMLButtonElement {
    const button = createHudButton(tab, () => {
      this.selectedTab = tab;
      this.signature = "";
      this.update();
    });
    button.dataset.inventoryTab = tab;
    button.style.flex = "1";
    return button;
  }

  private syncTabs(): void {
    for (const element of this.tabs.children) {
      const button = element as HTMLButtonElement;
      button.style.borderColor = button.dataset.inventoryTab === this.selectedTab
        ? HUD_GOLD
        : "#555a75";
      button.style.color = button.dataset.inventoryTab === this.selectedTab
        ? HUD_GOLD
        : "#f2f0eb";
    }
  }

  private createRow(
    row: ReturnType<typeof inventoryRows>[number],
  ): HTMLDivElement {
    const element = document.createElement("div");
    element.style.cssText =
      "padding:6px;border:1px solid #454960;background:rgba(24,25,39,.86)";
    const heading = document.createElement("div");
    heading.style.cssText =
      "display:flex;justify-content:space-between;gap:8px;font-weight:700";
    const binding = row.boundSlot === null ? "" : ` [${row.boundSlot + 1}]`;
    heading.append(
      document.createTextNode(`${row.name}${binding}`),
      document.createTextNode(`×${row.quantity}`),
    );
    const flavor = document.createElement("div");
    flavor.textContent = row.flavor ?? row.category;
    flavor.style.cssText =
      `color:${HUD_MUTED};font-size:10px;margin:3px 0 5px;overflow-wrap:anywhere`;
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
    if (row.canEquip) actions.append(this.equipButton(row.id));
    if (row.canUse) actions.append(
      createHudButton("use", () => this.connection.useItem(row.id)),
    );
    if (row.canHotbar) actions.append(this.hotbarButton(row.id));
    actions.append(createHudButton("drop one", () => this.connection.drop(row.id)));
    element.append(heading, flavor, actions);
    return element;
  }

  private equipButton(itemId: string): HTMLButtonElement {
    const equipped = this.connection.weapon === itemId;
    return createHudButton(equipped ? "unequip" : "equip", () => {
      this.connection.equip(equipped ? null : itemId);
    });
  }

  private hotbarButton(itemId: string): HTMLButtonElement {
    const existing = this.connection.hotbar.indexOf(itemId);
    const label = existing >= 0 ? `slot ${existing + 1}` : "hotbar";
    return createHudButton(label, () => {
      const slot = nextAvailableHotbarSlot(this.connection.hotbar, itemId);
      if (slot < 0) {
        this.connection.pushToast("The hotbar is full.");
        return;
      }
      this.connection.assignSlot(slot, itemId);
    });
  }
}
