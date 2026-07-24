/** Composes the browser-native first-person HUD and its keyboard focus contract. */
import type { World } from "@dc2d/engine";
import { isTouchDevice } from "../input/touchDetect.js";
import type { Connection } from "../net/connection.js";
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HudWindowManager } from "./HudWindows.js";
import type { FirstPersonState } from "./movement.js";
import { ThreeDownedOverlay } from "./ThreeDownedOverlay.js";
import { ThreeHudBuffs } from "./ThreeHudBuffs.js";
import { ThreeHudChat } from "./ThreeHudChat.js";
import { ThreeHudContacts } from "./ThreeHudContacts.js";
import { ThreeHudCraft } from "./ThreeHudCraft.js";
import { ThreeHudHotbar } from "./ThreeHudHotbar.js";
import { ThreeHudInventory } from "./ThreeHudInventory.js";
import { ThreeHudKeyboard } from "./ThreeHudKeyboard.js";
import { ThreeHudNotices } from "./ThreeHudNotices.js";
import { ThreeHudSettings } from "./ThreeHudSettings.js";
import {
  createHudKeyboard,
  createHudSettings,
  mountHudRoot,
} from "./ThreeHudSetup.js";
import { ThreeHudStatus } from "./ThreeHudStatus.js";
import { ThreeHudStash } from "./ThreeHudStash.js";
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
  onSelectHotbar?: (index: number) => void;
}

export class ThreeHud {
  readonly element = document.createElement("div");
  private readonly manager: HudWindowManager;
  private readonly status = new ThreeHudStatus();
  private readonly hotbar: ThreeHudHotbar;
  private readonly buffs = new ThreeHudBuffs();
  private readonly weapon = new ThreeHudWeapon();
  private readonly telemetry = new ThreeHudTelemetry();
  private readonly party = new ThreePartyTracker();
  private readonly chat: ThreeHudChat;
  private readonly inventory: ThreeHudInventory;
  private readonly contacts: ThreeHudContacts;
  private readonly craft: ThreeHudCraft;
  private readonly stash: ThreeHudStash;
  private readonly downed: ThreeDownedOverlay;
  private readonly invite: ThreePartyInvite;
  private readonly tutorials = new ThreeHudTutorials();
  private readonly notices = new ThreeHudNotices();
  private readonly settings: ThreeHudSettings;
  private readonly touch: ThreeHudTouchOverlay;
  private readonly keyboard: ThreeHudKeyboard;

  constructor(options: ThreeHudOptions) {
    const { root, connection, focusGame } = options;
    this.hotbar = new ThreeHudHotbar(options.onSelectHotbar);
    mountHudRoot(root, this.element);
    this.chat = new ThreeHudChat(connection, isTouchDevice(), focusGame);
    this.inventory = new ThreeHudInventory(connection);
    this.contacts = new ThreeHudContacts((name) => this.chat.startDm(name));
    this.craft = new ThreeHudCraft((recipe) => connection.craft(recipe));
    this.stash = new ThreeHudStash(
      (index) => connection.stashOp("put", index),
      (index) => connection.stashOp("take", index),
    );
    this.manager = new HudWindowManager(this.element);
    threeHudWindowSpecs(this.windowContents())
      .forEach((window) => this.manager.add(window));
    this.touch = new ThreeHudTouchOverlay(() => this.toggleInventory());
    this.settings = createHudSettings(this.element, this.manager, options);
    this.downed = new ThreeDownedOverlay(this.element);
    this.invite = new ThreePartyInvite(connection);
    this.element.append(this.invite.element, this.tutorials.element, this.touch.element, this.notices.element);
    this.keyboard = createHudKeyboard({
      toggleInventory: () => this.toggleInventory(),
      selectHotbar: (index) => this.hotbar.select(index),
      focusChat: () => this.chat.focus(),
      leaveChat: () => {
        this.chat.leave();
        focusGame();
      },
      chatOwnsFocus: () => this.chat.ownsFocus(),
    }, options);
    if (options.showReticle !== false) this.addReticle();
  }

  update(update: ThreeHudUpdate): void {
    const { connection, world, player, yaw, mouseCaptured } = update;
    this.chat.update();
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
  }

  toggleInventory(): void {
    this.manager.setVisible(
      "three-inventory",
      !this.manager.isVisible("three-inventory"),
    );
  }

  closeInventory(): void {
    this.manager.setVisible("three-inventory", false);
  }

  inventoryOpen(): boolean {
    return this.manager.isVisible("three-inventory");
  }

  focusChat(): void {
    this.chat.focus();
  }

  toggleContacts(): void {
    this.toggleWindow("three-contacts");
  }

  closeContacts(): void {
    this.manager.setVisible("three-contacts", false);
  }

  toggleCraft(): void {
    this.toggleWindow("three-craft");
  }

  closeCraft(): void {
    this.manager.setVisible("three-craft", false);
  }

  craftOpen(): boolean {
    return this.manager.isVisible("three-craft");
  }

  openStash(): void {
    this.manager.setVisible("three-stash", true);
  }

  closeStash(): void {
    this.manager.setVisible("three-stash", false);
  }

  stashOpen(): boolean {
    return this.manager.isVisible("three-stash");
  }

  dispose(): void {
    this.keyboard.dispose();
    this.settings.dispose();
    this.manager.dispose();
    this.element.remove();
  }

  private windowContents() {
    return {
      status: this.status.element,
      buffs: this.buffs.element,
      hotbar: this.hotbar.element,
      chat: this.chat.element,
      inventory: this.inventory.element,
      weapon: this.weapon.element,
      party: this.party.element,
      telemetry: this.telemetry.element,
      contacts: this.contacts.element,
      craft: this.craft.element,
      stash: this.stash.element,
    };
  }

  private toggleWindow(id: string): void {
    this.manager.setVisible(id, !this.manager.isVisible(id));
  }

  private updateSnapshotPanels(snapshot: HudFakeSnapshot): void {
    this.contacts.update(snapshot.contacts);
    this.craft.update(snapshot.craft);
    this.stash.update(snapshot.stash);
    this.notices.update(snapshot, performance.now());
    if (!snapshot.craft.nearby) this.closeCraft();
    if (!snapshot.stash.nearby) this.closeStash();
  }

  private addReticle(): void {
    const reticle = document.createElement("div");
    reticle.style.cssText =
      "position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;" +
      "border:1px solid rgba(255,255,255,.82);box-sizing:border-box;pointer-events:none";
    this.element.append(reticle);
  }
}
