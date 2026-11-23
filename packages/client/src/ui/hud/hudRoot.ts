/** Coordinates BottomHotbar, VitalsBar, InventoryModal, ChestModal, CraftingPanel, CharacterPanel, Minimap, and drag/drop. */
import {
  AI_TUNING, type CharacterAppearance, type InventorySnapshot, type PlayerSnapshot,
  type WorldChestSnapshot, type WorldChunkCache, type WorldEntitySnapshot,
} from "@dc2d/engine";
import { MinimapOverlay } from "../map/minimapOverlay.js";
import { BottomHotbar } from "./bottomHotbar.js";
import { CharacterPanel } from "./characterPanel.js";
import { ChestModal } from "./chestModal.js";
import { CraftingPanel } from "./craftingPanel.js";
import { ensureHudStyles } from "./hudStyles.js";
import { InventoryModal } from "./inventoryModal.js";
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
  private openPanel: ActiveHudPanel = "none";
  private openChestId: string | null = null;
  private mapOpen = false;
  private lastState: HudSyncState | null = null;

  constructor(host: HTMLElement, actions: HudActions) {
    ensureHudStyles();
    this.drag = new SlotDragManager({
      ...actions,
      onChestTransfer: (req) => actions.onChestTransfer({ ...req, chestId: this.openChestId ?? req.chestId }),
    });
    this.hotbar = new BottomHotbar(host, this.drag, actions.onToggleTorch);
    this.vitals = new VitalsBar(host);
    this.inventoryModal = new InventoryModal(host, this.drag, {
      onClose: () => this.closePanels(), onOpenCrafting: () => this.togglePanel("crafting"),
    });
    this.chestModal = new ChestModal(host, this.drag, {
      onTakeAll: () => { if (this.openChestId) actions.onChestTakeAll(this.openChestId); },
      onClose: () => this.closePanels(),
    });
    this.craftingPanel = new CraftingPanel(host, actions.onCraft, {
      onClose: () => this.closePanels(), onOpenInventory: () => this.togglePanel("inventory"),
    });
    this.characterPanel = new CharacterPanel(host, actions.onSetCharacter, () => this.closePanels());
    this.minimap = new MinimapOverlay(host, () => { this.mapOpen = false; this.refreshFromCache(); });
  }

  activePanel(): ActiveHudPanel { return this.openPanel; }
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
    this.openPanel = this.openPanel === panel ? "none" : panel;
    if (this.openPanel !== "chest") this.openChestId = null;
    if (this.openPanel === "none") this.drag.clearTapSelection();
    this.refreshFromCache();
  }

  closePanels(): void {
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
    this.hotbar.sync(state.inventory, tap, Boolean(state.localPlayer?.torchLit));
    this.vitals.sync(state.localPlayer, state.entities);
    this.inventoryModal.sync(state.inventory, { open: invOpen, tapSource: tap, player: state.localPlayer });
    this.chestModal.sync({ chest, inv: state.inventory, open: chestOpen, tapSource: tap });
    this.craftingPanel.sync(state.inventory, this.openPanel === "crafting");
    this.characterPanel.sync({ open: this.openPanel === "character", name: state.name, appearance: state.appearance, armor: state.inventory.armor });
    this.syncMinimap(state);
  }

  private syncMinimap(state: HudSyncState): void {
    if (!state.cache) return;
    this.minimap.sync({
      visible: this.openPanel === "none" && (this.mapOpen || state.localPlayer?.heldItem === "map"),
      cache: state.cache, local: state.localPlayer,
      players: state.players ?? [], entities: state.entities ?? [], chests: state.chests ?? [],
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
