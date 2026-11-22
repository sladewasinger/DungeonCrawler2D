/** Coordinates BottomHotbar, minimalist InventoryModal, CraftingPanel, and unified drag/drop. */
import type { InventorySnapshot } from "@dc2d/engine";
import { BottomHotbar } from "./bottomHotbar.js";
import { CraftingPanel } from "./craftingPanel.js";
import { ensureHudStyles } from "./hudStyles.js";
import { InventoryModal } from "./inventoryModal.js";
import { SlotDragManager } from "./slotDragManager.js";
import type { HudActions } from "./slotRenderer.js";

export type ActiveHudPanel = "none" | "inventory" | "crafting";

export class HudRoot {
  private readonly drag: SlotDragManager;
  private readonly hotbar: BottomHotbar;
  private readonly inventoryModal: InventoryModal;
  private readonly craftingPanel: CraftingPanel;
  private openPanel: ActiveHudPanel = "none";
  private lastInv: InventorySnapshot | null = null;

  constructor(host: HTMLElement, actions: HudActions) {
    ensureHudStyles();
    this.drag = new SlotDragManager(actions, () => this.refreshFromCache());
    this.hotbar = new BottomHotbar(host, this.drag);
    this.inventoryModal = new InventoryModal(host, this.drag, () => this.closePanels());
    this.craftingPanel = new CraftingPanel(host, actions.onCraft, () => this.closePanels());
  }

  activePanel(): ActiveHudPanel {
    return this.openPanel;
  }

  toggleInventory(): void {
    this.openPanel = this.openPanel === "inventory" ? "none" : "inventory";
    if (this.openPanel !== "inventory") this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  toggleCrafting(): void {
    this.openPanel = this.openPanel === "crafting" ? "none" : "crafting";
    this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  closePanels(): void {
    if (this.openPanel === "none") return;
    this.openPanel = "none";
    this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  sync(inv: InventorySnapshot): void {
    this.lastInv = inv;
    const invOpen = this.openPanel === "inventory";
    this.drag.setState(inv, invOpen);
    const tap = this.drag.activeTapSource();
    this.hotbar.sync(inv, tap);
    this.inventoryModal.sync(inv, { open: invOpen, tapSource: tap });
    this.craftingPanel.sync(inv, this.openPanel === "crafting");
  }

  private refreshFromCache(): void {
    if (this.lastInv) this.sync(this.lastInv);
  }
}
