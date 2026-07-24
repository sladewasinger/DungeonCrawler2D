/** Composes the browser-native first-person HUD and its keyboard focus contract. */
import type { World } from "@dc2d/engine";
import { isTouchDevice } from "../input/touchDetect.js";
import type { Connection } from "../net/connection.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWindowManager } from "./HudWindows.js";
import type { FirstPersonState } from "./movement.js";
import { ThreeDownedOverlay } from "./ThreeDownedOverlay.js";
import { ThreeHudBuffs } from "./ThreeHudBuffs.js";
import { ThreeHudHotbar } from "./ThreeHudHotbar.js";
import { ThreeHudInventory } from "./ThreeHudInventory.js";
import { ThreeHudKeyboard } from "./ThreeHudKeyboard.js";
import { syncThreeHudLiveState } from "./ThreeHudLiveState.js";
import { ThreeHudNotices } from "./ThreeHudNotices.js";
import { ThreeHudSettings } from "./ThreeHudSettings.js";
import {
  createHudKeyboard,
  createHudSettings,
  mountHudOverlays,
  mountHudRoot,
  mountHudReticle,
} from "./ThreeHudSetup.js";
import { ThreeHudStatus } from "./ThreeHudStatus.js";
import { createThreeHudPanels, type ThreeHudPanels } from "./ThreeHudPanels.js";
import { ThreeHudTelemetry } from "./ThreeHudTelemetry.js";
import { ThreeHudTouchOverlay } from "./ThreeHudTouchOverlay.js";
import { ThreeHudTutorials } from "./ThreeHudTutorials.js";
import { ThreeHudWeapon } from "./ThreeHudWeapon.js";
import { threeHudWindowSpecs } from "./ThreeHudWindowSpecs.js";
import { ThreePartyInvite } from "./ThreePartyInvite.js";
import { ThreePartyTracker } from "./ThreePartyTracker.js";
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
}

export class ThreeHud {
  readonly element = document.createElement("div");
  private readonly manager: HudWindowManager;
  private readonly status = new ThreeHudStatus(); private readonly hotbar: ThreeHudHotbar;
  private readonly buffs = new ThreeHudBuffs(); private readonly weapon = new ThreeHudWeapon();
  private readonly telemetry = new ThreeHudTelemetry(); private readonly party = new ThreePartyTracker();
  private readonly inventory: ThreeHudInventory; private readonly panels: ThreeHudPanels;
  private readonly downed: ThreeDownedOverlay; private readonly invite: ThreePartyInvite;
  private readonly tutorials: ThreeHudTutorials; private readonly notices = new ThreeHudNotices();
  private readonly settings: ThreeHudSettings; private readonly touch: ThreeHudTouchOverlay;
  private readonly keyboard: ThreeHudKeyboard;
  private readonly focusGame: () => void;
  private readonly setTextInputFocused: (focused: boolean) => void;
  constructor(options: ThreeHudOptions) {
    const { root, connection, focusGame } = options, touchDevice = isTouchDevice();
    this.focusGame = focusGame;
    this.setTextInputFocused = options.setTextInputFocused ?? (() => {});
    this.tutorials = new ThreeHudTutorials(touchDevice ? "touch" : "keyboard");
    this.hotbar = new ThreeHudHotbar(options.onSelectHotbar);
    mountHudRoot(root, this.element);
    this.inventory = new ThreeHudInventory(connection, () => this.closeInventory());
    this.panels = createThreeHudPanels(connection, touchDevice, focusGame, this.setTextInputFocused, {
      toggleContacts: () => this.toggleContacts(), closeContacts: () => this.closeContacts(),
      closeCraft: () => this.closeCraft(), closeStash: () => this.closeStash(),
    });
    this.manager = new HudWindowManager(this.element);
    threeHudWindowSpecs(this.windowContents()).forEach((window) => this.manager.add(window));
    this.touch = new ThreeHudTouchOverlay(() => this.toggleInventory());
    this.settings = createHudSettings(this.element, this.manager, {
      ...options,
      replayTutorials: () => this.tutorials.replay(),
    });
    this.downed = new ThreeDownedOverlay(this.element);
    this.invite = new ThreePartyInvite(connection);
    mountHudOverlays(this.element, [
      this.invite.element, this.tutorials.element, this.touch.element,
      this.notices.element, this.inventory.element,
    ]);
    this.keyboard = createHudKeyboard({
      toggleInventory: () => this.toggleInventory(),
      closeInventory: () => this.closeInventory(),
      inventoryOpen: () => this.inventoryOpen(),
      selectHotbar: (index) => this.hotbar.select(index),
      focusChat: () => this.panels.chat.focus(),
      leaveChat: () => {
        this.panels.chat.leave();
        focusGame();
      },
      chatOwnsFocus: () => this.panels.chat.ownsFocus(),
      closeOverlays: () => this.closeOverlays(),
    }, options);
    if (options.showReticle !== false) mountHudReticle(this.element);
  }
  update(update: ThreeHudUpdate): void {
    const { connection, world, player, yaw, mouseCaptured } = update;
    this.panels.chat.update();
    this.inventory.update();
    this.status.update(connection, world.floor);
    this.hotbar.update(connection, update.snapshot?.selectedSlot);
    this.buffs.update(connection);
    this.weapon.update(connection);
    this.party.update(connection, player, yaw);
    this.telemetry.update(connection, world, player, yaw, mouseCaptured);
    this.downed.update(connection);
    this.invite.update();
    this.tutorials.update(connection, performance.now());
    this.touch.update(update.snapshot?.touch ?? null);
    if (update.snapshot) this.updateSnapshotPanels(update.snapshot);
    else syncThreeHudLiveState(connection, world, this.hotbar.selectedSlot(),
      this.panels, this.notices, () => this.closeCraft(), () => this.closeStash());
  }
  toggleInventory(): void {
    const opening = !this.inventoryOpen();
    this.inventory.toggle(this.focusGame);
    this.setTextInputFocused(opening);
  }
  closeInventory(): void {
    if (!this.inventoryOpen()) return;
    this.inventory.closeAndFocus(this.focusGame);
    this.setTextInputFocused(false);
  }
  inventoryOpen(): boolean {
    return this.inventory.isOpen();
  }

  focusChat(): void { this.panels.chat.focus(); }
  toggleChat(): void { this.toggleWindow("three-chat"); }

  toggleContacts(): void { this.toggleWindow("three-contacts"); }
  closeContacts(): void { this.manager.setVisible("three-contacts", false); }
  toggleCraft(): void {
    const opening = !this.craftOpen();
    if (opening) this.closeStash();
    this.manager.setVisible("three-craft", opening);
  }

  closeCraft(): void { this.manager.setVisible("three-craft", false); }
  craftOpen(): boolean {
    return this.manager.isVisible("three-craft");
  }

  openStash(): void {
    this.manager.setVisible("three-stash", true);
  }
  toggleStash(): boolean {
    const opening = !this.stashOpen();
    if (opening) this.closeCraft();
    this.manager.setVisible("three-stash", opening);
    return opening;
  }
  closeStash(): void { this.manager.setVisible("three-stash", false); }
  stashOpen(): boolean {
    return this.manager.isVisible("three-stash");
  }

  closeOverlays(): boolean {
    const wasOpen = this.craftOpen() || this.stashOpen() ||
      this.manager.isVisible("three-contacts");
    this.closeCraft();
    this.closeStash();
    this.closeContacts();
    if (wasOpen) this.focusGame();
    return wasOpen;
  }

  dispose(): void {
    this.setTextInputFocused(false);
    this.inventory.dispose();
    this.keyboard.dispose();
    this.settings.dispose();
    this.manager.dispose();
    this.element.remove();
  }
  private windowContents() {
    return {
      status: this.status.element, buffs: this.buffs.element,
      hotbar: this.hotbar.element, chat: this.panels.chat.element, weapon: this.weapon.element,
      party: this.party.element, telemetry: this.telemetry.element,
      contacts: this.panels.contacts.element,
      craft: this.panels.craft.element, stash: this.panels.stash.element,
    };
  }
  private toggleWindow(id: string): void {
    this.manager.setVisible(id, !this.manager.isVisible(id));
  }

  private updateSnapshotPanels(snapshot: HudFakeSnapshot): void {
    this.panels.contacts.update(snapshot.contacts);
    this.panels.craft.update(snapshot.craft);
    this.panels.stash.update(snapshot.stash);
    this.notices.update(snapshot, performance.now());
    if (!snapshot.craft.nearby) this.closeCraft();
    if (!snapshot.stash.nearby) this.closeStash();
  }
}
