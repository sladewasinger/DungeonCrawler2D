/** Owns the browser-native first-person HUD, its focus contract, and play/edit modes. */
import type { World } from "@dc2d/engine";
import { BUILD_SHA } from "../buildInfo.js";
import { isTouchDevice } from "../input/touchDetect.js";
import type { Connection } from "../net/connection.js";
import type { FirstPersonState } from "./movement.js";
import { HudWindowManager } from "./HudWindows.js";
import { createHudPanelTitle, createHudSlots } from "./ThreeHudPanels.js";
import { ThreeHudChat } from "./ThreeHudChat.js";
import type { ViewDistance } from "./viewDistance.js";
import { createViewDistanceButton } from "./viewDistanceButton.js";

const createGear = () => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "⚙";
  button.setAttribute("aria-label", "HUD settings");
  button.style.cssText = "position:absolute;right:12px;top:12px;z-index:1000;width:34px;height:34px;border:1px solid #71758b;background:rgba(18,19,30,.76);color:#f3f0e9;font:20px sans-serif;pointer-events:auto";
  return button;
};

export interface ThreeHudUpdate {
  connection: Connection;
  world: World;
  player: FirstPersonState;
  yaw: number;
  mouseCaptured: boolean;
}

export class ThreeHud {
  readonly element = document.createElement("div");
  private readonly healthFill = document.createElement("div");
  private readonly healthLabel = document.createElement("div");
  private readonly healthTitle = document.createElement("div");
  private readonly readout = document.createElement("div");
  private readonly manager: HudWindowManager;
  private readonly chat: ThreeHudChat;
  private readonly mobile = isTouchDevice();
  private inventoryVisible = false;
  private settingsVisible = false;
  private editing = false;

  constructor(root: HTMLElement, connection: Connection, private readonly focusGame: () => void, private viewDistance: ViewDistance, private readonly setViewDistance: (viewDistance: ViewDistance) => void) {
    this.chat = new ThreeHudChat(connection, this.mobile, () => this.focusGame());
    root.style.position = "relative";
    this.element.style.cssText = "position:absolute;inset:0;z-index:2;pointer-events:none;color:#f2f0eb;font:12px monospace;text-shadow:0 2px 4px #000";
    root.append(this.element);
    this.manager = new HudWindowManager(this.element);
    this.addWindows();
    this.mountSettings();
    this.bindKeyboard();
    this.addReticle();
  }

  update({ connection, world, player, yaw, mouseCaptured }: ThreeHudUpdate): void {
    this.chat.update();
    const heading = Math.round((((yaw * 180) / Math.PI) % 360 + 360) % 360);
    const health = Math.max(0, connection.hp);
    const healthFraction = connection.maxHp > 0 ? health / connection.maxHp : 0;
    this.healthFill.style.width = `${Math.min(1, healthFraction) * 100}%`;
    this.healthLabel.textContent = `${Math.ceil(health)} / ${connection.maxHp}`;
    this.healthTitle.textContent = health <= 0 ? "Respawning" : `Crawler · Floor ${world.floor}`;
    this.readout.textContent = `build ${BUILD_SHA}\nfloor ${world.floor} · ${connection.status}\nseed ${world.worldSeed}\nx ${player.x.toFixed(1)}, y ${player.z.toFixed(1)}, z ${player.y.toFixed(2)}\nheading ${heading}°\n${mouseCaptured ? "mouse captured" : "click the world to capture mouse"}`;
  }

  private addWindows(): void {
    this.manager.add({ id: "three-health", title: "Status", width: 286, height: 116, anchor: "top-left", content: this.createHealthPanel() });
    this.manager.add({ id: "three-hotbar", title: "Hotbar", width: 620, height: 106, anchor: "bottom-center", content: this.createHotbarPanel() });
    this.manager.add({
      id: "three-chat",
      title: "Chat",
      width: 350,
      height: 220,
      anchor: "bottom-left",
      mobile: { width: 320, height: 200, anchor: "center-left" },
      interactive: true,
      content: this.createChatPanel(),
    });
    this.manager.add({ id: "three-inventory", title: "Inventory", width: 304, height: 254, anchor: "center-right", content: this.createInventoryPanel() });
    this.manager.add({ id: "three-telemetry", title: "World Status", width: 224, height: 150, anchor: "top-right", content: this.createTelemetryPanel() });
    this.manager.setVisible("three-inventory", false);
  }

  private mountSettings(): void {
    const gear = createGear();
    const menu = this.createSettingsMenu();
    gear.addEventListener("click", () => {
      this.settingsVisible = !this.settingsVisible;
      menu.hidden = !this.settingsVisible;
    });
    this.element.append(gear, menu);
  }

  private createSettingsMenu(): HTMLDivElement {
    const menu = document.createElement("div");
    menu.hidden = true;
    menu.style.cssText = "position:absolute;right:12px;top:52px;z-index:1001;width:188px;padding:10px;background:rgba(18,19,30,.94);border:1px solid #686d86;box-shadow:0 8px 22px rgba(0,0,0,.48);pointer-events:auto";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.style.cssText = "width:100%;padding:7px;border:1px solid #757a93;background:#292b40;color:#f2f0eb;font:12px monospace";
    const updateLabel = () => { edit.textContent = `HUD Edit Mode: ${this.editing ? "ON" : "OFF"}`; };
    updateLabel();
    edit.addEventListener("click", () => {
      this.editing = !this.editing;
      this.manager.setEditing(this.editing);
      updateLabel();
    });
    menu.append(edit, createViewDistanceButton(() => this.viewDistance, (viewDistance) => this.setDistance(viewDistance)));
    return menu;
  }

  private setDistance(viewDistance: ViewDistance): void {
    this.viewDistance = viewDistance;
    this.setViewDistance(viewDistance);
  }

  private bindKeyboard(): void {
    window.addEventListener("keydown", (event) => this.handleKeyboard(event), true);
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (event.code === "Tab") {
      event.preventDefault();
      if (this.chat.ownsFocus()) return;
      this.inventoryVisible = !this.inventoryVisible;
      this.manager.setVisible("three-inventory", this.inventoryVisible);
    }
    if (event.code === "Enter" && !this.chat.ownsFocus()) {
      event.preventDefault();
      this.chat.focus();
    }
    if (event.code === "Escape" && this.chat.ownsFocus()) this.chat.leave();
  }

  private addReticle(): void {
    const reticle = document.createElement("div");
    reticle.style.cssText = "position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border:1px solid rgba(255,255,255,.82);box-sizing:border-box;pointer-events:none";
    this.element.append(reticle);
  }

  private createHealthPanel(): HTMLElement {
    const panel = document.createElement("div");
    this.healthTitle.style.cssText = "color:#aaaec8;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px";
    panel.append(this.healthTitle);
    const track = document.createElement("div");
    track.style.cssText = "height:18px;border:1px solid #666b80;background:#282535;padding:2px;box-sizing:border-box";
    this.healthFill.style.cssText = "height:100%;width:100%;background:#db4c4d";
    track.append(this.healthFill);
    this.healthLabel.style.cssText = "font-size:15px;font-weight:700;margin-top:5px";
    panel.append(track, this.healthLabel);
    return panel;
  }

  private createHotbarPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.append(createHudSlots());
    return panel;
  }

  private createChatPanel(): HTMLElement {
    return this.chat.element;
  }

  private createInventoryPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.append(createHudPanelTitle("Bag · prototype inventory"));
    const list = document.createElement("div");
    list.style.cssText = "display:grid;grid-template-columns:1fr auto;gap:6px 12px";
    const items: Array<readonly [string, string]> = [["Rusty Sword", "equipped"], ["Bandage", "x3"], ["Water Flask", "x2"], ["Torch", "x2"], ["Rag", "x6"], ["Stick", "x5"]];
    items.forEach(([name, count]) => this.addInventoryItem(list, name, count));
    panel.append(list);
    return panel;
  }

  private addInventoryItem(list: HTMLDivElement, name: string, count: string): void {
    const item = document.createElement("span");
    item.textContent = name;
    const quantity = document.createElement("span");
    quantity.textContent = count;
    quantity.style.color = "#aaaec8";
    list.append(item, quantity);
  }

  private createTelemetryPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.style.paddingTop = "40px";
    panel.append(this.readout);
    return panel;
  }
}
