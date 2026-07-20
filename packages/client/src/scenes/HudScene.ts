/**
 * HUD overlay scene: runs in parallel with the game scene on its own camera, so
 * world lighting postFX (vignette/bloom, docs/VISUAL_DIRECTION.md "darkness is the
 * canvas") never dims or blurs UI legibility. Two ways in: launched with a `source`
 * (DungeonScene, real net/inventory state pulled fresh every frame) or self-gated on
 * ?hud=1|death (the gallery's fake-data preview) — a no-op scene otherwise, so it's
 * safe to always keep launched.
 */
import Phaser from "phaser";
import { fakeHudSnapshot, type HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWidgets, type SocialActions, type StationActions } from "../ui/widgets/hud/index.js";
import type { InventoryActions } from "../ui/widgets/hud/inventoryWindow.js";

/** ?hud=1 shows the HUD-on state with fake data; ?hud=death also forces the death overlay. */
const HUD_QUERY_PARAM = "hud";
/** ?inventory=1 (with ?hud=1|death) forces the inventory window open — a screenshot aid,
 * not a shipped gameplay flag; real play only opens it via [I]/[Tab] or the bag button. */
const INVENTORY_QUERY_PARAM = "inventory";
/** ?craft=1 / ?stash=1 (with ?hud=1|death) — the same screenshot-aid pattern as
 * ?inventory=1, for the Epic 7.12 windows; real play only opens them via [C]/[E] near a station. */
const CRAFT_QUERY_PARAM = "craft";
const STASH_QUERY_PARAM = "stash";

export interface HudSceneData {
  /** Pulled fresh every update() — DungeonScene's real snapshot builder. */
  source?: () => HudFakeSnapshot;
  /** The inventory window's network intents — omitted in the gallery's fake-data preview. */
  actions?: InventoryActions;
  /** Chat-tab-click + contacts-DM-button intents — omitted in the gallery's fake-data preview. */
  social?: SocialActions;
  /** The crafting-table/stash windows' network intents (Epic 7.12) — omitted in the gallery's fake-data preview. */
  stations?: StationActions;
}

export class HudScene extends Phaser.Scene {
  private hud: HudWidgets | undefined;
  private snapshot: HudFakeSnapshot | undefined;
  private source: (() => HudFakeSnapshot) | undefined;
  private actions: InventoryActions | undefined;
  private social: SocialActions | undefined;
  private stations: StationActions | undefined;

  constructor() {
    super("hud");
  }

  init(data?: HudSceneData): void {
    this.source = data?.source;
    this.actions = data?.actions;
    this.social = data?.social;
    this.stations = data?.stations;
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get(HUD_QUERY_PARAM);
    if (!this.source && mode !== "1" && mode !== "death") return;
    this.snapshot = mode === "death" ? fakeHudSnapshot(true) : mode === "1" ? fakeHudSnapshot(false) : undefined;
    this.hud = new HudWidgets(this, { width: this.scale.width, height: this.scale.height }, this.actions, this.social, this.stations);
    if (params.get(INVENTORY_QUERY_PARAM) === "1") this.hud.toggleInventory();
    if (params.get(CRAFT_QUERY_PARAM) === "1") this.hud.toggleCraftPanel();
    if (params.get(STASH_QUERY_PARAM) === "1") this.hud.openStashPanel();
    const onResize = (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  update(time: number): void {
    if (!this.hud) return;
    const snapshot = this.source ? this.source() : this.snapshot;
    if (snapshot) this.hud.update(snapshot, time);
  }

  /** InputHud contract: forwarded to the live HudWidgets instance, if one is running. */
  hitTest(screenX: number, screenY: number): string | null {
    return this.hud?.hitTest(screenX, screenY) ?? null;
  }

  /** Toggles the chat panel — the touch layout's collapse-to-chip affordance (InputHooks.onToggleChat). */
  toggleChat(): void {
    this.hud?.toggleChat();
  }

  /** Toggles the inventory window — [I]/[Tab] or the touch bag button (InputHooks.onToggleInventory). */
  toggleInventory(): void {
    this.hud?.toggleInventory();
  }

  /** InventoryPanelSource contract (inputAdapters.ts's createInputPanels). */
  inventoryOpen(): boolean {
    return this.hud?.inventoryOpen() ?? false;
  }

  /** InventoryPanelSource contract. */
  selectedInventoryItem(): string | null {
    return this.hud?.selectedInventoryItem() ?? null;
  }

  /** InventoryPanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeInventory(): void {
    this.hud?.closeInventory();
  }

  /** [o] or the chat-tab chip (InputHooks.onToggleContacts). */
  toggleContacts(): void {
    this.hud?.toggleContacts();
  }

  /** [Esc] (InputHooks.onCloseOverlays). */
  closeContacts(): void {
    this.hud?.closeContacts();
  }

  /** PanelSource contract (scenes/dungeon/panelAdapters.ts's createInputPanels). */
  craftOpen(): boolean {
    return this.hud?.craftOpen() ?? false;
  }

  /** PanelSource contract — flips the craft window open/closed, no range gating (the caller checks that). */
  toggleCraftPanel(): void {
    this.hud?.toggleCraftPanel();
  }

  /** PanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeCraftPanel(): void {
    this.hud?.closeCraftPanel();
  }

  /** PanelSource contract. */
  stashOpen(): boolean {
    return this.hud?.stashOpen() ?? false;
  }

  /** PanelSource contract — opens the stash window if it isn't already open. */
  openStashPanel(): void {
    this.hud?.openStashPanel();
  }

  /** PanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeStashPanel(): void {
    this.hud?.closeStashPanel();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    this.hud?.resize({ width: gameSize.width, height: gameSize.height });
  }
}
