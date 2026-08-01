/** Composes the browser-native first-person HUD and its keyboard focus contract. */
import type { World } from "@dc2d/engine";
import type { Connection } from "../../../net/connection/connection.js";
import type { SessionMenuActions } from "../../../ui/sessionMenu/SessionMenu.js";
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import type { FirstPersonState } from "../../../three/input/movement.js";
import type { HudComposition } from "./HudComposition.js";
import { HudKeyboard } from "../model/HudKeyboard.js";
import {
  createHudKeyboard,
  mountHudReticle,
} from "./HudSetup.js";
import type { ViewDistance } from "../../../three/terrain/view/viewDistance.js";
import { createHudTemplate } from "../styles/hudTemplate.js";
import { updateHud } from "./SharedHtmlHudUpdate.js";
import { AdminDebugPanel } from "../admin/AdminDebugPanel.js";
import { createSharedHudParts } from "./sharedHudParts.js";
export interface HudUpdate {
  connection: Connection;
  world: World;
  player: FirstPersonState;
  yaw: number;
  mouseCaptured: boolean;
  fps?: number; latencyMs?: number;
  giveUpHoldProgress?: number;
  snapshot?: HudFakeSnapshot;
  updateCompass?: boolean;
  updateTelemetry?: boolean;
}
export interface HudOptions {
  root: HTMLElement;
  connection: Connection;
  focusGame: () => void;
  viewDistance?: ViewDistance;
  setViewDistance?: (viewDistance: ViewDistance) => void;
  bindKeyboard?: boolean;
  showReticle?: boolean;
  /** The Three route owns Connection.visualEvents itself. Phaser's shared HTML HUD
   * must leave that queue for DungeonScene's world-space VFX consumer. */
  showHealthFeedback?: boolean;
  onSelectHotbar?: (index: number | null) => void;
  setTextInputFocused?: (focused: boolean) => void;
  session: Omit<SessionMenuActions, "focusGame">;
}

export class SharedHtmlHud {
  readonly element = createHudTemplate<HTMLDivElement>("hud-root-template");
  readonly parts: HudComposition;
  readonly adminDebug: AdminDebugPanel;
  private readonly keyboard: HudKeyboard;
  private readonly focusGame: () => void;
  private readonly setTextInputFocused: (focused: boolean) => void;
  private readonly showHealthFeedback: boolean;
  private readonly releaseAdminEditing: () => void;

  constructor(options: HudOptions) {
    this.focusGame = options.focusGame;
    this.setTextInputFocused = options.setTextInputFocused ?? (() => {});
    this.showHealthFeedback = options.showHealthFeedback !== false;
    this.adminDebug = new AdminDebugPanel(options.connection, options.focusGame);
    this.parts = createSharedHudParts(this, options);
    this.adminDebug.attach(this.parts.manager);
    this.releaseAdminEditing = this.parts.settings.onEditingChange(
      (editing) => this.adminDebug.setEditing(editing),
    );
    this.keyboard = this.createKeyboard(options);
    if (options.showReticle !== false) mountHudReticle(this.element);
  }

  private createKeyboard(options: HudOptions): HudKeyboard {
    const { parts } = this;
    return createHudKeyboard({
      toggleInventory: () => this.toggleInventory(),
      closeInventory: () => this.closeInventory(),
      inventoryOpen: () => this.inventoryOpen(),
      selectHotbar: (index) => parts.hotbar.select(index),
      focusChat: () => parts.panels.chat.focus(),
      leaveChat: () => {
        parts.panels.chat.leave();
        this.focusGame();
      },
      chatOwnsFocus: () => parts.panels.chat.ownsFocus(),
      closeOverlays: () => this.closeOverlays(),
      sessionMenuOpen: () => parts.sessionMenu.isOpen(),
      toggleSessionMenu: () => parts.sessionMenu.toggle(),
      closeSessionMenu: () => parts.sessionMenu.close(),
    }, options);
  }
  get setTextInputFocus(): (focused: boolean) => void {
    return this.setTextInputFocused;
  }
  update(update: HudUpdate): void {
    updateHud({ hud: this, update, showHealthFeedback: this.showHealthFeedback });
  }

  toggleInventory(): void {
    const opening = !this.inventoryOpen();
    this.parts.inventory.toggle(this.focusGame);
    this.setTextInputFocused(opening);
  }

  closeInventory(): void {
    if (!this.inventoryOpen()) return;
    this.parts.inventory.closeAndFocus(this.focusGame);
    this.setTextInputFocused(false);
  }

  inventoryOpen(): boolean {
    return this.parts.inventory.isOpen();
  }

  blocksGameplay(): boolean {
    return this.inventoryOpen() || this.parts.sessionMenu.isOpen() ||
      this.parts.panels.chat.ownsFocus();
  }

  sessionMenuOpen(): boolean {
    return this.parts.sessionMenu.isOpen();
  }
  toggleSessionMenu(): void {
    this.parts.sessionMenu.toggle();
  }
  focusChat(): void { this.parts.panels.chat.focus(); }
  toggleChat(): void { this.parts.overlays.toggleChat(); }
  toggleContacts(): void { this.parts.overlays.toggleContacts(); }
  closeContacts(): void { this.parts.overlays.closeContacts(); }
  toggleCraft(): void { this.parts.overlays.toggleCraft(); }
  closeCraft(): void { this.parts.overlays.closeCraft(); }
  craftOpen(): boolean { return this.parts.overlays.craftOpen(); }
  openStash(): void { this.parts.overlays.openStash(); }
  toggleStash(): boolean { return this.parts.overlays.toggleStash(); }
  closeStash(): void { this.parts.overlays.closeStash(); }
  stashOpen(): boolean { return this.parts.overlays.stashOpen(); }

  closeOverlays(): boolean { return this.parts.overlays.closeAll(); }
  dispose(): void {
    this.setTextInputFocused(false);
    this.keyboard.dispose();
    this.parts.panels.chat.dispose();
    this.parts.sessionMenu.dispose();
    this.releaseAdminEditing();
    this.parts.settings.dispose();
    this.adminDebug.dispose();
    this.parts.manager.dispose();
    this.element.remove();
  }
}
