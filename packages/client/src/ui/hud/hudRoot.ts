/** Coordinates BottomHotbar, VitalsBar, InventoryModal, CraftingPanel, CharacterPanel, and pointer drag/drop. */
import type { CharacterAppearance, InventorySnapshot, PlayerSnapshot } from "@dc2d/engine";
import { BottomHotbar } from "./bottomHotbar.js";
import { CharacterPanel } from "./characterPanel.js";
import { CraftingPanel } from "./craftingPanel.js";
import { ensureHudStyles } from "./hudStyles.js";
import { InventoryModal } from "./inventoryModal.js";
import { SlotDragManager } from "./slotDragManager.js";
import type { HudActions } from "./slotRenderer.js";
import { VitalsBar } from "./vitalsBar.js";

export type ActiveHudPanel = "none" | "inventory" | "crafting" | "character";

export interface HudSyncState {
  readonly inventory: InventorySnapshot;
  readonly name: string;
  readonly appearance: CharacterAppearance;
  readonly localPlayer?: PlayerSnapshot | undefined;
}

export class HudRoot {
  private readonly drag: SlotDragManager;
  private readonly hotbar: BottomHotbar;
  private readonly vitals: VitalsBar;
  private readonly inventoryModal: InventoryModal;
  private readonly craftingPanel: CraftingPanel;
  private readonly characterPanel: CharacterPanel;
  private openPanel: ActiveHudPanel = "none";
  private lastState: HudSyncState | null = null;

  constructor(host: HTMLElement, actions: HudActions) {
    ensureHudStyles();
    this.drag = new SlotDragManager(actions, () => this.refreshFromCache());
    this.hotbar = new BottomHotbar(host, this.drag, actions.onToggleTorch);
    this.vitals = new VitalsBar(host);
    this.inventoryModal = new InventoryModal(host, this.drag, {
      onClose: () => this.closePanels(),
      onOpenCrafting: () => this.togglePanel("crafting"),
    });
    this.craftingPanel = new CraftingPanel(host, actions.onCraft, {
      onClose: () => this.closePanels(),
      onOpenInventory: () => this.togglePanel("inventory"),
    });
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
    this.hotbar.sync(state.inventory, tap, Boolean(state.localPlayer?.torchLit));
    this.vitals.sync(state.localPlayer);
    this.inventoryModal.sync(state.inventory, { open: invOpen, tapSource: tap, player: state.localPlayer });
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
