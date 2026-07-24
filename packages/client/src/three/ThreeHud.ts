/** Composes the browser-native first-person HUD and its keyboard focus contract. */
import type { World } from "@dc2d/engine";
import { isTouchDevice } from "../input/touchDetect.js";
import type { Connection } from "../net/connection.js";
import type { SessionMenuActions } from "../ui/sessionMenu/SessionMenu.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import type { FirstPersonState } from "./movement.js";
import {
  createThreeHudComposition,
  type ThreeHudComposition,
} from "./ThreeHudComposition.js";
import { ThreeHudKeyboard } from "./ThreeHudKeyboard.js";
import { syncThreeHudLiveState } from "./ThreeHudLiveState.js";
import {
  createHudKeyboard,
  mountHudReticle,
} from "./ThreeHudSetup.js";
import type { ViewDistance } from "./viewDistance.js";
export interface ThreeHudUpdate {
  connection: Connection;
  world: World;
  player: FirstPersonState;
  yaw: number;
  mouseCaptured: boolean;
  snapshot?: HudFakeSnapshot;
}
export interface ThreeHudOptions {
  root: HTMLElement;
  connection: Connection;
  focusGame: () => void;
  viewDistance?: ViewDistance;
  setViewDistance?: (viewDistance: ViewDistance) => void;
  bindKeyboard?: boolean;
  showReticle?: boolean;
  onSelectHotbar?: (index: number | null) => void;
  setTextInputFocused?: (focused: boolean) => void;
  session: Omit<SessionMenuActions, "focusGame">;
}

export class ThreeHud {
  readonly element = document.createElement("div");
  private readonly parts: ThreeHudComposition;
  private readonly keyboard: ThreeHudKeyboard;
  private readonly focusGame: () => void;
  private readonly setTextInputFocused: (focused: boolean) => void;

  constructor(options: ThreeHudOptions) {
    this.focusGame = options.focusGame;
    this.setTextInputFocused = options.setTextInputFocused ?? (() => {});
    this.parts = createThreeHudComposition(
      {
        root: options.root,
        element: this.element,
        connection: options.connection,
        focusGame: options.focusGame,
        setTextInputFocused: this.setTextInputFocused,
        touchDevice: isTouchDevice(),
        ...(options.viewDistance === undefined
          ? {}
          : { viewDistance: options.viewDistance }),
        ...(options.setViewDistance
          ? { setViewDistance: options.setViewDistance }
          : {}),
        ...(options.onSelectHotbar
          ? { onSelectHotbar: options.onSelectHotbar }
          : {}),
        session: options.session,
      },
      {
        closeInventory: () => this.closeInventory(),
        toggleContacts: () => this.toggleContacts(),
        closeContacts: () => this.closeContacts(),
        closeCraft: () => this.closeCraft(),
        closeStash: () => this.closeStash(),
        toggleInventory: () => this.toggleInventory(),
      },
    );
    this.keyboard = this.createKeyboard(options);
    if (options.showReticle !== false) mountHudReticle(this.element);
  }

  private createKeyboard(options: ThreeHudOptions): ThreeHudKeyboard {
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
  update(update: ThreeHudUpdate): void {
    const { connection, world, player, yaw, mouseCaptured } = update;
    const { parts } = this;
    parts.panels.chat.update();
    parts.inventory.update();
    parts.status.update(connection, world.floor);
    parts.hotbar.update(connection, update.snapshot?.selectedSlot);
    parts.buffs.update(connection);
    parts.weapon.update(connection);
    parts.party.update(connection, player, yaw);
    parts.telemetry.update(connection, world, player, yaw, mouseCaptured);
    parts.downed.update(connection);
    parts.invite.update();
    parts.sessionMenu.update(
      connection.status === "connected" && connection.hp > 0,
    );
    parts.tutorials.update(connection, performance.now());
    parts.touch.update(update.snapshot?.touch ?? null);
    if (update.snapshot) this.updateSnapshotPanels(update.snapshot);
    else {
      syncThreeHudLiveState(
        connection,
        world,
        parts.hotbar.selectedSlot(),
        parts.panels,
        parts.notices,
        () => this.closeCraft(),
        () => this.closeStash(),
      );
    }
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
    return this.inventoryOpen() || this.parts.sessionMenu.isOpen();
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
    this.parts.inventory.dispose();
    this.keyboard.dispose();
    this.parts.sessionMenu.dispose();
    this.parts.settings.dispose();
    this.parts.manager.dispose();
    this.element.remove();
  }

  private updateSnapshotPanels(snapshot: HudFakeSnapshot): void {
    this.parts.overlays.update(snapshot, this.parts.notices);
  }
}
