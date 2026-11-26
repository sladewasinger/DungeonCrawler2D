/** Coordinates BottomHotbar, VitalsBar, InventoryModal, ChestModal, CraftingPanel, CharacterPanel, Minimap, and drag/drop. */
import {
  AI_TUNING, type CharacterAppearance, type DiscoveryStateSnapshot, type InventorySnapshot, type PlayerSnapshot,
  type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { MinimapOverlay } from "../map/minimapOverlay.js";
import { BottomHotbar } from "./bottomHotbar.js";
import { CharacterPanel } from "./characterPanel.js";
import { ChestModal } from "./chestModal.js";
import { CraftingPanel } from "./craftingPanel.js";
import { ensureHudStyles } from "./hudStyles.js";
import { InventoryModal } from "./inventoryModal.js";
import { ItemCardPopover } from "./itemCard/itemCardPopover.js";
import { SlotDragManager } from "./slotDragManager.js";
import type { HudActions } from "./slotRenderer.js";
import { VitalsBar } from "./vitalsBar.js";

export type ActiveHudPanel = "none" | "inventory" | "crafting" | "character" | "chest";

export interface HudSyncState {
  readonly inventory: InventorySnapshot;
  readonly name: string;
  readonly appearance: CharacterAppearance;
  readonly localPlayer?: PlayerSnapshot | undefined;
  readonly cache?: WorldChunkCache | undefined;
  readonly players?: readonly PlayerSnapshot[] | undefined;
  readonly entities?: readonly WorldEntitySnapshot[] | undefined;
  readonly chests?: readonly WorldChestSnapshot[] | undefined;
  readonly discovery?: DiscoveryStateSnapshot | undefined;
}

export class HudRoot {
  private readonly drag: SlotDragManager;
  private readonly hotbar: BottomHotbar;
  private readonly vitals: VitalsBar;
  private readonly inventoryModal: InventoryModal;
  private readonly chestModal: ChestModal;
  private readonly craftingPanel: CraftingPanel;
  private readonly characterPanel: CharacterPanel;
  private readonly minimap: MinimapOverlay;
  private readonly itemCard: ItemCardPopover;
  private readonly actions: HudActions;
  private openPanel: ActiveHudPanel = "none";
  private openChestId: string | null = null;
  private mapOpen = false;
  private lastState: HudSyncState | null = null;

  constructor(host: HTMLElement, actions: HudActions) {
    ensureHudStyles();
    this.actions = actions;
    const wrapped = this.buildWrappedActions(actions);
    this.drag = new SlotDragManager(wrapped);
    this.itemCard = new ItemCardPopover(host, wrapped);
    this.hotbar = new BottomHotbar(host, this.drag, {
      onToggleTorch: actions.onToggleTorch,
      onToggleMap: () => { this.toggleMap(); actions.onMapToggled?.(); },
    });
    this.vitals = new VitalsBar(host);
    this.inventoryModal = new InventoryModal(host, this.drag, { onClose: () => this.closePanels(), onOpenCrafting: () => this.togglePanel("crafting") });
    this.chestModal = new ChestModal(host, this.drag, { onTakeAll: () => this.handleTakeAll(), onClose: () => this.closePanels() });
    this.craftingPanel = new CraftingPanel(host, actions.onCraft, { onClose: () => this.closePanels(), onOpenInventory: () => this.togglePanel("inventory") });
    this.characterPanel = new CharacterPanel(host, actions.onSetCharacter, () => this.closePanels());
    this.minimap = new MinimapOverlay(host, () => { this.mapOpen = false; this.refreshFromCache(); });
  }

  private buildWrappedActions(actions: HudActions): HudActions {
    return {
      ...actions,
      onChestTransfer: (req) => {
        const res = actions.onChestTransfer({ ...req, chestId: this.openChestId ?? req.chestId });
        if (res === false && req.from === "chest") this.chestModal.showNotice("Inventory Full — drop or swap an item");
        return res;
      },
      onDropItem: (req) => actions.onDropItem(req.source === "chest" ? { ...req, chestId: this.openChestId ?? req.chestId } : req),
      onInspectItem: (source, rect) => { this.itemCard.open(source, rect); this.refreshFromCache(); },
      onHoverItem: (source, rect) => { this.itemCard.hover(source, rect); this.refreshFromCache(); },
      onDismissInspect: () => this.itemCard.close(),
    };
  }

  private handleTakeAll(): void {
    if (!this.openChestId) return;
    if (this.actions.onChestTakeAll(this.openChestId) === false) this.chestModal.showNotice("Inventory Full — drop or swap an item");
  }

  activePanel(): ActiveHudPanel { return this.openPanel; }
  private dropHoveredSource(hovered: NonNullable<ReturnType<SlotDragManager["hoveredFilledSource"]>>): void {
    if (hovered.kind === "slot") this.actions.onDropItem({ source: "inv", slotIndex: hovered.index });
    else if (hovered.kind === "armor") this.actions.onDropItem({ source: "armor", armorSlot: hovered.armorSlot });
    else if (this.openChestId) this.actions.onDropItem({ source: "chest", slotIndex: hovered.index, chestId: this.openChestId });
  }

  dropShortcutItem(): boolean {
    if (!this.lastState) return false;
    const hovered = this.drag.hoveredFilledSource();
    if (hovered) { this.dropHoveredSource(hovered); return true; }
    if (this.openPanel !== "none") return false;
    const idx = this.lastState.inventory.selectedHotbar;
    if (!this.lastState.inventory.slots[idx]) return false;
    this.actions.onDropItem({ source: "inv", slotIndex: idx });
    return true;
  }
  toggleInventory(): void { this.togglePanel("inventory"); }
  toggleCrafting(): void { this.togglePanel("crafting"); }
  toggleCharacter(): void { this.togglePanel("character"); }
  toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen && this.openPanel !== "none") {
      this.openPanel = "none"; this.openChestId = null; this.drag.clearTapSelection();
    }
    this.refreshFromCache();
  }

  openChest(chestId: string): void {
    this.openChestId = chestId;
    this.openPanel = "chest";
    this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  private togglePanel(panel: ActiveHudPanel): void {
    this.itemCard.close();
    this.openPanel = this.openPanel === panel ? "none" : panel;
    if (this.openPanel !== "chest") this.openChestId = null;
    if (this.openPanel === "none") this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  closePanels(): void {
    this.itemCard.close();
    if (this.openPanel === "none" && !this.mapOpen) return;
    this.openPanel = "none";
    this.mapOpen = false;
    this.openChestId = null;
    this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  sync(state: HudSyncState): void {
    this.lastState = state;
    const chest = this.resolveOpenChest(state);
    const invOpen = this.openPanel === "inventory";
    const chestOpen = this.openPanel === "chest" && Boolean(chest);
    this.drag.setState(state.inventory, { panelOpen: invOpen || chestOpen, chestSlots: chest?.slots ?? null });
    const tap = this.drag.activeTapSource();
    this.hotbar.sync(state.inventory, tap, { torchLit: Boolean(state.localPlayer?.torchLit), mapOpen: this.isMapVisible(state) });
    this.vitals.sync(state.localPlayer, state.entities);
    this.inventoryModal.sync(state.inventory, { open: invOpen, tapSource: tap, player: state.localPlayer });
    this.chestModal.sync({ chest, inv: state.inventory, open: chestOpen, tapSource: tap });
    this.craftingPanel.sync(state.inventory, this.openPanel === "crafting");
    this.characterPanel.sync({ open: this.openPanel === "character", name: state.name, appearance: state.appearance, armor: state.inventory.armor });
    this.itemCard.sync(state.inventory, chest);
    this.syncMinimap(state);
  }

  private isMapVisible(state: HudSyncState): boolean {
    return this.openPanel === "none" && (this.mapOpen || state.localPlayer?.heldItem === "map");
  }

  private syncMinimap(state: HudSyncState): void {
    if (!state.cache) return;
    this.minimap.sync({
      visible: this.isMapVisible(state),
      cache: state.cache, local: state.localPlayer,
      players: state.players ?? [], entities: state.entities ?? [], chests: state.chests ?? [], discovery: state.discovery,
    });
  }

  private resolveOpenChest(state: HudSyncState): WorldChestSnapshot | undefined {
    if (this.openPanel !== "chest" || !this.openChestId) return undefined;
    const chest = state.chests?.find((c) => c.id === this.openChestId);
    const p = state.localPlayer;
    if (!chest || (p && Math.hypot(chest.x - p.x, chest.y - p.y) > AI_TUNING.chestInteractRadiusTiles + 1.4)) {
      this.openPanel = "none";
      this.openChestId = null;
      return undefined;
    }
    return chest;
  }

  private refreshFromCache(): void { if (this.lastState) this.sync(this.lastState); }
}
