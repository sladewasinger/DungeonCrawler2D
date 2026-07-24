/**
 * HUD overlay scene: runs in parallel with the game scene on its own camera, so
 * world lighting postFX (vignette/bloom, docs/VISUAL_DIRECTION.md "darkness is the
 * canvas") never dims or blurs UI legibility. Two ways in: launched with a `source`
 * (DungeonScene, real net/inventory state pulled fresh every frame) or self-gated on
 * ?hud=1|death (the gallery's fake-data preview) — a no-op scene otherwise, so it's
 * safe to always keep launched.
 */
import Phaser from "phaser";
import { BossBarWidget } from "../ui/widgets/hud/bossBar.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWidgets } from "../ui/widgets/hud/index.js";
import type { Connection } from "../net/connection.js";
import { HtmlTouchHitRegions } from "../three/HtmlTouchHitRegions.js";
import { ThreeHud } from "../three/ThreeHud.js";
import { createLiveHtmlHud } from "./hudHtml.js";
import { applyHudPreviewAids, resolveHudPreview } from "./hudPreview.js";
import type { HudSceneData } from "./hudSceneData.js";
export type { HudSceneData } from "./hudSceneData.js";

export class HudScene extends Phaser.Scene {
  private hud: HudWidgets | undefined;
  /** Epic 7.14 boss HP bar — built from `hud.registry` rather than folded into
   * HudWidgets itself, which is already at its file-size cap. */
  private bossBar: BossBarWidget | undefined;
  private snapshot: HudFakeSnapshot | undefined;
  private source: (() => HudFakeSnapshot) | undefined;
  private actions: HudSceneData["actions"];
  private social: HudSceneData["social"];
  private stations: HudSceneData["stations"];
  private connection: Connection | undefined;
  private htmlHud: ThreeHud | undefined;
  private readonly touchHits = new HtmlTouchHitRegions();
  private onSelectHotbar: ((index: number | null) => void) | undefined;
  private session: HudSceneData["session"];

  constructor() {
    super("hud");
  }

  init(data?: HudSceneData): void {
    this.source = data?.source;
    this.actions = data?.actions;
    this.social = data?.social;
    this.stations = data?.stations;
    this.connection = data?.connection;
    this.onSelectHotbar = data?.onSelectHotbar;
    this.session = data?.session;
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.snapshot = this.source ? undefined : resolveHudPreview(params) ?? undefined;
    if (!this.source && !this.snapshot) return;
    if (this.source && this.connection) this.createHtmlHud(this.connection);
    else this.createPreviewHud();
    applyHudPreviewAids(params, this.snapshot, this.hud);
    const onResize = (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  update(time: number): void {
    const snapshot = this.source ? this.source() : this.snapshot;
    if (!snapshot) return;
    if (this.htmlHud) {
      this.updateHtmlHud(snapshot);
      return;
    }
    this.hud?.update(snapshot, time);
    this.bossBar?.update(snapshot.boss);
  }

  /** InputHud contract: forwarded to the live HudWidgets instance, if one is running. */
  hitTest(screenX: number, screenY: number): string | null {
    if (!this.htmlHud) return this.hud?.hitTest(screenX, screenY) ?? null;
    return this.touchHits.hitTest(screenX, screenY, this.scale.width, this.scale.height);
  }

  /** Toggles the chat panel — the touch layout's collapse-to-chip affordance (InputHooks.onToggleChat). */
  toggleChat(): void {
    if (this.htmlHud) this.htmlHud.toggleChat();
    else this.hud?.toggleChat();
  }

  /** Toggles the inventory window — [I]/[Tab] or the touch bag button (InputHooks.onToggleInventory). */
  toggleInventory(): void {
    if (this.htmlHud) this.htmlHud.toggleInventory();
    else this.hud?.toggleInventory();
  }

  /** InventoryPanelSource contract (inputAdapters.ts's createInputPanels). */
  inventoryOpen(): boolean {
    return this.htmlHud?.inventoryOpen() ?? this.hud?.inventoryOpen() ?? false;
  }

  blocksGameplay(): boolean {
    return this.htmlHud?.blocksGameplay() ?? this.hud?.inventoryOpen() ?? false;
  }

  sessionMenuOpen(): boolean {
    return this.htmlHud?.sessionMenuOpen() ?? false;
  }

  toggleSessionMenu(): void {
    this.htmlHud?.toggleSessionMenu();
  }

  /** InventoryPanelSource contract. */
  selectedInventoryItem(): string | null {
    return this.htmlHud ? null : this.hud?.selectedInventoryItem() ?? null;
  }

  /** InventoryPanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeInventory(): void {
    if (this.htmlHud) this.htmlHud.closeInventory();
    else this.hud?.closeInventory();
  }

  focusChat(): void {
    this.htmlHud?.focusChat();
  }

  /** [o] or the chat-tab chip (InputHooks.onToggleContacts). */
  toggleContacts(): void {
    if (this.htmlHud) this.htmlHud.toggleContacts();
    else this.hud?.toggleContacts();
  }

  /** [Esc] (InputHooks.onCloseOverlays). */
  closeContacts(): void {
    if (this.htmlHud) this.htmlHud.closeContacts();
    else this.hud?.closeContacts();
  }

  closeTransientOverlays(): boolean {
    return this.htmlHud?.closeOverlays() ?? false;
  }

  /** PanelSource contract (scenes/dungeon/panelAdapters.ts's createInputPanels). */
  craftOpen(): boolean {
    return this.htmlHud?.craftOpen() ?? this.hud?.craftOpen() ?? false;
  }

  /** PanelSource contract — flips the craft window open/closed, no range gating (the caller checks that). */
  toggleCraftPanel(): void {
    if (this.htmlHud) this.htmlHud.toggleCraft();
    else this.hud?.toggleCraftPanel();
  }

  /** PanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeCraftPanel(): void {
    if (this.htmlHud) this.htmlHud.closeCraft();
    else this.hud?.closeCraftPanel();
  }

  /** PanelSource contract. */
  stashOpen(): boolean {
    return this.htmlHud?.stashOpen() ?? this.hud?.stashOpen() ?? false;
  }

  /** PanelSource contract — opens the stash window if it isn't already open. */
  openStashPanel(): void {
    if (this.htmlHud) this.htmlHud.openStash();
    else this.hud?.openStashPanel();
  }

  /** PanelSource contract — [Esc]'s InputPanels.closeAll sweep. */
  closeStashPanel(): void {
    if (this.htmlHud) this.htmlHud.closeStash();
    else this.hud?.closeStashPanel();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.main.setSize(gameSize.width, gameSize.height);
    const viewport = { width: gameSize.width, height: gameSize.height };
    this.hud?.resize(viewport);
    if (this.hud) this.bossBar?.resize(this.hud.registry, viewport);
  }

  private createHtmlHud(connection: Connection): void {
    const root = document.getElementById("app");
    if (!root) throw new Error("Missing #app root for HTML HUD.");
    this.htmlHud = createLiveHtmlHud({
      root,
      connection,
      focusGame: () => {
        this.game.canvas.tabIndex = -1;
        this.game.canvas.focus({ preventScroll: true });
      },
      setTextInputFocused: (focused: boolean) => {
        const keyboard = this.input.keyboard;
        if (focused) keyboard?.disableGlobalCapture();
        else keyboard?.enableGlobalCapture();
      },
      ...(this.onSelectHotbar
        ? { onSelectHotbar: this.onSelectHotbar }
        : {}),
      session: this.session ?? {
        respawn: () => {},
        quitToTitle: () => {},
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.htmlHud?.dispose();
      this.htmlHud = undefined;
    });
  }

  private updateHtmlHud(snapshot: HudFakeSnapshot): void {
    const connection = this.connection;
    const world = connection?.world;
    if (!this.htmlHud || !connection || !world) return;
    this.touchHits.setActive(snapshot.touch !== null);
    const player = {
      x: snapshot.coords.x,
      y: snapshot.coords.z,
      z: snapshot.coords.y,
      verticalVelocity: 0,
      grounded: true,
    };
    this.htmlHud.update({
      connection,
      world,
      player,
      yaw: -(snapshot.compassBearingDeg * Math.PI) / 180,
      mouseCaptured: true,
      snapshot,
    });
  }

  private createPreviewHud(): void {
    const viewport = { width: this.scale.width, height: this.scale.height };
    this.hud = new HudWidgets(
      this,
      viewport,
      this.actions,
      this.social,
      this.stations,
    );
    this.bossBar = new BossBarWidget(this, this.hud.registry, viewport);
  }
}
