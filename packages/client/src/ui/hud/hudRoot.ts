/** Coordinates BottomHotbar, InventoryModal, CraftingPanel, CharacterPanel, and pointer drag/drop. */
import type { CharacterAppearance, InventorySnapshot } from "@dc2d/engine";
import { BottomHotbar } from "./bottomHotbar.js";
import { CharacterPanel } from "./characterPanel.js";
import { CraftingPanel } from "./craftingPanel.js";
import { ensureHudStyles } from "./hudStyles.js";
import { InventoryModal } from "./inventoryModal.js";
import { SlotDragManager } from "./slotDragManager.js";
import type { HudActions } from "./slotRenderer.js";

export type ActiveHudPanel = "none" | "inventory" | "crafting" | "character";

export interface HudSyncState {
  readonly inventory: InventorySnapshot;
  readonly name: string;
  readonly appearance: CharacterAppearance;
}

export class HudRoot {
  private readonly drag: SlotDragManager;
  private readonly hotbar: BottomHotbar;
  private readonly inventoryModal: InventoryModal;
  private readonly craftingPanel: CraftingPanel;
  private readonly characterPanel: CharacterPanel;
  private openPanel: ActiveHudPanel = "none";
  private lastState: HudSyncState | null = null;

  constructor(host: HTMLElement, actions: HudActions) {
    ensureHudStyles();
    this.drag = new SlotDragManager(actions, () => this.refreshFromCache());
    this.hotbar = new BottomHotbar(host, this.drag);
    this.inventoryModal = new InventoryModal(host, this.drag, () => this.closePanels());
    this.craftingPanel = new CraftingPanel(host, actions.onCraft, () => this.closePanels());
    this.characterPanel = new CharacterPanel(host, actions.onSetCharacter, () => this.closePanels());
  }

  activePanel(): ActiveHudPanel { return this.openPanel; }
  toggleInventory(): void { this.togglePanel("inventory"); }
  toggleCrafting(): void { this.togglePanel("crafting"); }
  toggleCharacter(): void { this.togglePanel("character"); }

  private togglePanel(panel: ActiveHudPanel): void {
    this.openPanel = this.openPanel === panel ? "none" : panel;
    if (this.openPanel !== "inventory") this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  closePanels(): void {
    if (this.openPanel === "none") return;
    this.openPanel = "none";
    this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  sync(state: HudSyncState): void {
    this.lastState = state;
    const invOpen = this.openPanel === "inventory";
    this.drag.setState(state.inventory, invOpen);
    const tap = this.drag.activeTapSource();
    this.hotbar.sync(state.inventory, tap);
    this.inventoryModal.sync(state.inventory, { open: invOpen, tapSource: tap });
    this.craftingPanel.sync(state.inventory, this.openPanel === "crafting");
    this.characterPanel.sync({
      open: this.openPanel === "character",
      name: state.name,
      appearance: state.appearance,
      armor: state.inventory.armor,
    });
  }

  private refreshFromCache(): void { if (this.lastState) this.sync(this.lastState); }
}
