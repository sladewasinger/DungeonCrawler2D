/** Composes the browser-native first-person HUD and its keyboard focus contract. */
import type { World } from "@dc2d/engine";
import { isTouchDevice } from "../input/touchDetect.js";
import type { Connection } from "../net/connection.js";
import { HudWindowManager, type HudWindowSpec } from "./HudWindows.js";
import type { FirstPersonState } from "./movement.js";
import { ThreeDownedOverlay } from "./ThreeDownedOverlay.js";
import { ThreeHudBuffs } from "./ThreeHudBuffs.js";
import { ThreeHudChat } from "./ThreeHudChat.js";
import { ThreeHudHotbar } from "./ThreeHudHotbar.js";
import { ThreeHudInventory } from "./ThreeHudInventory.js";
import { ThreeHudSettings } from "./ThreeHudSettings.js";
import { ThreeHudStatus } from "./ThreeHudStatus.js";
import { ThreeHudTelemetry } from "./ThreeHudTelemetry.js";
import { ThreeHudWeapon } from "./ThreeHudWeapon.js";
import { ThreePartyInvite } from "./ThreePartyInvite.js";
import { ThreePartyTracker } from "./ThreePartyTracker.js";
import type { ViewDistance } from "./viewDistance.js";

export interface ThreeHudUpdate {
  connection: Connection;
  world: World;
  player: FirstPersonState;
  yaw: number;
  mouseCaptured: boolean;
}

export class ThreeHud {
  readonly element = document.createElement("div");
  private readonly manager: HudWindowManager;
  private readonly status = new ThreeHudStatus();
  private readonly hotbar = new ThreeHudHotbar();
  private readonly buffs = new ThreeHudBuffs();
  private readonly weapon = new ThreeHudWeapon();
  private readonly telemetry = new ThreeHudTelemetry();
  private readonly party = new ThreePartyTracker();
  private readonly chat: ThreeHudChat;
  private readonly inventory: ThreeHudInventory;
  private readonly downed: ThreeDownedOverlay;
  private readonly invite: ThreePartyInvite;

  constructor(
    root: HTMLElement,
    connection: Connection,
    private readonly focusGame: () => void,
    viewDistance: ViewDistance,
    setViewDistance: (viewDistance: ViewDistance) => void,
  ) {
    root.style.position = "relative";
    this.element.style.cssText =
      "position:absolute;inset:0;z-index:2;pointer-events:none;color:#f2f0eb;" +
      "font:12px monospace;text-shadow:0 2px 4px #000";
    root.append(this.element);
    this.chat = new ThreeHudChat(connection, isTouchDevice(), focusGame);
    this.inventory = new ThreeHudInventory(connection);
    this.manager = new HudWindowManager(this.element);
    this.addWindows();
    let activeDistance = viewDistance;
    new ThreeHudSettings(
      this.element,
      this.manager,
      () => activeDistance,
      (distance) => {
        activeDistance = distance;
        setViewDistance(distance);
      },
    );
    this.downed = new ThreeDownedOverlay(this.element);
    this.invite = new ThreePartyInvite(connection);
    this.element.append(this.invite.element);
    this.bindKeyboard();
    this.addReticle();
  }

  update(update: ThreeHudUpdate): void {
    const { connection, world, player, yaw, mouseCaptured } = update;
    this.chat.update();
    this.inventory.update();
    this.status.update(connection, world.floor);
    this.hotbar.update(connection);
    this.buffs.update(connection);
    this.weapon.update(connection);
    this.party.update(connection, player, yaw);
    this.telemetry.update(connection, world, player, yaw, mouseCaptured);
    this.downed.update(connection);
    this.invite.update();
  }

  private addWindows(): void {
    const windows: HudWindowSpec[] = [
      this.spec("three-health", "Status", 286, 108, "top-left", this.status.element),
      this.spec("three-buffs", "Buffs and debuffs", 286, 72, "center-left", this.buffs.element),
      this.spec("three-hotbar", "Hotbar", 620, 58, "bottom-center", this.hotbar.element, true),
      this.spec("three-chat", "Chat", 300, 230, "bottom-left", this.chat.element, true, {
        width: 280,
        height: 190,
        anchor: "center-left",
      }),
      this.spec("three-inventory", "Inventory", 390, 420, "center-right", this.inventory.element, true, undefined, false),
      this.spec("three-weapon", "Active weapon", 230, 84, "bottom-right", this.weapon.element),
      this.spec("three-party", "Party", 230, 154, "top-center", this.party.element),
      this.spec("three-telemetry", "World status", 244, 150, "top-right", this.telemetry.element),
    ];
    windows.forEach((window) => this.manager.add(window));
  }

  private spec(
    id: string,
    title: string,
    width: number,
    height: number,
    anchor: HudWindowSpec["anchor"],
    content: HTMLElement,
    interactive = false,
    mobile?: HudWindowSpec["mobile"],
    defaultVisible = true,
  ): HudWindowSpec {
    return {
      id,
      title,
      width,
      height,
      anchor,
      content,
      interactive,
      defaultVisible,
      ...(mobile ? { mobile } : {}),
    };
  }

  private bindKeyboard(): void {
    window.addEventListener("keydown", (event) => this.handleKeyboard(event), true);
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (event.code === "Tab") {
      this.toggleInventory(event);
      return;
    }
    if (event.code.startsWith("Digit")) this.selectHotbar(event);
    if (event.code === "Enter" && !this.chat.ownsFocus()) {
      event.preventDefault();
      this.chat.focus();
    }
    if (event.code === "Escape" && this.chat.ownsFocus()) {
      event.preventDefault();
      this.chat.leave();
      this.focusGame();
    }
  }

  private toggleInventory(event: KeyboardEvent): void {
    event.preventDefault();
    if (this.chat.ownsFocus()) return;
    this.manager.setVisible(
      "three-inventory",
      !this.manager.isVisible("three-inventory"),
    );
  }

  private selectHotbar(event: KeyboardEvent): void {
    if (this.chat.ownsFocus()) return;
    const index = Number(event.code.slice(5)) - 1;
    if (index < 0 || index >= 9) return;
    event.preventDefault();
    this.hotbar.select(index);
  }

  private addReticle(): void {
    const reticle = document.createElement("div");
    reticle.style.cssText =
      "position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;" +
      "border:1px solid rgba(255,255,255,.82);box-sizing:border-box;pointer-events:none";
    this.element.append(reticle);
  }
}
