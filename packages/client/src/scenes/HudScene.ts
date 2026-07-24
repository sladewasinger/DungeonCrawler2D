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
import { fakeHudSnapshot, type HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWidgets, type SocialActions, type StationActions } from "../ui/widgets/hud/index.js";
import type { InventoryActions } from "../ui/widgets/hud/inventoryWindow.js";
import type { Connection } from "../net/connection.js";
import { HtmlTouchHitRegions } from "../three/HtmlTouchHitRegions.js";
import { ThreeHud } from "../three/ThreeHud.js";

/** ?hud=1 shows the HUD-on state with fake data; ?hud=death also forces the death overlay. */
const HUD_QUERY_PARAM = "hud";
/** ?inventory=1 (with ?hud=1|death) forces the inventory window open — a screenshot aid,
 * not a shipped gameplay flag; real play only opens it via [I]/[Tab] or the bag button. */
const INVENTORY_QUERY_PARAM = "inventory";
/** ?craft=1 / ?stash=1 (with ?hud=1|death) — the same screenshot-aid pattern as
 * ?inventory=1, for the Epic 7.12 windows; real play only opens them via [C]/[E] near a station. */
const CRAFT_QUERY_PARAM = "craft";
const STASH_QUERY_PARAM = "stash";
/** ?boss=1 (with ?hud=1|death) — the same screenshot-aid pattern, forces a fake boss
 * into the AOI so Epic 7.14's boss HP bar has something to show without a live server. */
const BOSS_QUERY_PARAM = "boss";
const FAKE_BOSS = { name: "The Warden of Five", hp: 640, maxHp: 900 };

export interface HudSceneData {
  /** Pulled fresh every update() — DungeonScene's real snapshot builder. */
  source?: () => HudFakeSnapshot;
  /** The inventory window's network intents — omitted in the gallery's fake-data preview. */
  actions?: InventoryActions;
  /** Chat-tab-click + contacts-DM-button intents — omitted in the gallery's fake-data preview. */
  social?: SocialActions;
  /** The crafting-table/stash windows' network intents (Epic 7.12) — omitted in the gallery's fake-data preview. */
  stations?: StationActions;
  connection?: Connection;
  onSelectHotbar?: (index: number | null) => void;
}

export class HudScene extends Phaser.Scene {
  private hud: HudWidgets | undefined;
  /** Epic 7.14 boss HP bar — built from `hud.registry` rather than folded into
   * HudWidgets itself, which is already at its file-size cap. */
  private bossBar: BossBarWidget | undefined;
  private snapshot: HudFakeSnapshot | undefined;
  private source: (() => HudFakeSnapshot) | undefined;
  private actions: InventoryActions | undefined;
  private social: SocialActions | undefined;
  private stations: StationActions | undefined;
  private connection: Connection | undefined;
  private htmlHud: ThreeHud | undefined;
  private readonly touchHits = new HtmlTouchHitRegions();
  private onSelectHotbar: ((index: number | null) => void) | undefined;

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
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get(HUD_QUERY_PARAM);
    if (!this.source && mode !== "1" && mode !== "death") return;
    this.snapshot = mode === "death" ? fakeHudSnapshot(true) : mode === "1" ? fakeHudSnapshot(false) : undefined;
    if (this.source && this.connection) {
      this.createHtmlHud(this.connection);
    } else {
      this.createPreviewHud();
    }
    this.applyScreenshotAidParams(params);
    const onResize = (gameSize: Phaser.Structs.Size) => this.handleResize(gameSize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** ?inventory=1/?craft=1/?stash=1/?boss=1 — screenshot aids only, split out to keep create()'s complexity down. */
  private applyScreenshotAidParams(params: URLSearchParams): void {
    if (this.snapshot && params.get(BOSS_QUERY_PARAM) === "1") this.snapshot.boss = FAKE_BOSS;
    if (params.get(INVENTORY_QUERY_PARAM) === "1") this.hud?.toggleInventory();
    if (params.get(CRAFT_QUERY_PARAM) === "1") this.hud?.toggleCraftPanel();
    if (params.get(STASH_QUERY_PARAM) === "1") this.hud?.openStashPanel();
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
    return this.touchHits.hitTest(
      screenX,
      screenY,
      this.scale.width,
      this.scale.height,
    );
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
    const options = {
      root,
      connection,
      focusGame: () => this.game.canvas.focus({ preventScroll: true }),
      bindKeyboard: false,
      showReticle: false,
      ...(this.onSelectHotbar
        ? { onSelectHotbar: this.onSelectHotbar }
        : {}),
    };
    this.htmlHud = new ThreeHud(options);
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
