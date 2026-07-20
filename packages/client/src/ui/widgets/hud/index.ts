/**
 * HUD facade: registers every widget with a shared registry, owns their Phaser
 * instances, and drives per-frame updates from a HudFakeSnapshot (the gallery's
 * HUD-on state today; a live game wires the same update() from real net/inventory state).
 */
import type Phaser from "phaser";
import { isTouchDevice } from "../../../input/touchDetect.js";
import { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { BuffChipsWidget } from "./buffChips.js";
import { ChatPanelWidget, type ChatPanelActions } from "./chatPanel.js";
import { ConnectionStatusWidget } from "./connectionStatus.js";
import { ContactsWindowWidget, type ContactsActions } from "./contactsWindow.js";
import { DeathOverlayWidget } from "./deathOverlay.js";
import type { HudFakeSnapshot } from "./fakeData.js";
import { HealthBarWidget } from "./healthBar.js";
import { HotbarWidget } from "./hotbar.js";
import { InteractionPromptWidget } from "./interactionPrompt.js";
import { InventoryToggleButtonWidget } from "./inventoryToggleButton.js";
import { InventoryWindowWidget, type InventoryActions } from "./inventoryWindow.js";
import { ReconnectToastWidget } from "./reconnectToast.js";
import { TouchButtonsWidget } from "./touchButtons.js";
import { TouchStickWidget } from "./touchStick.js";
import { WeaponChipWidget } from "./weaponChip.js";

/** Touch-only registry nudges so the new corner controls don't fight the existing
 * (desktop-sized) HUD for space: shrink the 9-slot hotbar (its 400-logical-px width
 * is unavoidably wide at hudScale — see docs/client-proofs/touch-*.png), hide the
 * weapon chip (redundant with the sword-icon ATTACK button), and lift chat's anchor
 * clear of the joystick's rest zone. Desktop never calls this (isTouchDevice() gates
 * the caller), so it's untouched. */
function applyTouchLayoutOverrides(registry: WidgetRegistry): void {
  registry.setOverride("hotbar", { scale: 0.5 });
  registry.setOverride("weapon", { visible: false });
  registry.setOverride("chat", { offset: { x: 16, y: -150 } });
  // The inventory panel's 340px pre-hudScale width doubles to 680px — wider than a
  // ~390px portrait phone. Same fix as the hotbar above: half scale brings it back to
  // a legible, on-screen size instead of running off both edges.
  registry.setOverride("inventory", { scale: 0.5 });
  // Same overflow, same fix: the contacts panel's 220px width doubles to 440px.
  registry.setOverride("contacts", { scale: 0.5 });
  // Clears the touch-buttons cluster's top edge (touchButtons.ts) instead of sitting
  // right on top of it — only reachable on the ?camera=entities gallery preset /
  // standing near a pickup in real play, but real play hits it too.
  registry.setOverride("interaction", { offset: { x: 0, y: -170 } });
  // At a ~412px-wide portrait viewport the top-left health bar alone is nearly
  // full-width at hudScale (see docs/client-proofs/hud-indicators-mobile.png before
  // this fix), leaving no horizontal gap for the top-right ping/fps/coords stack
  // beside it — drop the stack below the health+buffs cluster instead of squeezing in.
  registry.setOverride("status", { offset: { x: -16, y: 100 } });
}

/** The gallery's ?hud=1 preview (no live Connection) still constructs HudWidgets — inert stand-ins so its Equip/Drop buttons don't throw. */
function noopInventoryActions(): InventoryActions {
  return { assignSlot: () => {}, equip: () => {}, drop: () => {} };
}

/** HudScene's live-vs-gallery actions bundle for the widgets this pass adds. */
export interface SocialActions {
  chat: ChatPanelActions;
  contacts: ContactsActions;
}

function noopSocialActions(): SocialActions {
  return {
    chat: { onSelectTab: () => {}, onToggleContacts: () => {} },
    contacts: { startDm: () => {} },
  };
}

export class HudWidgets {
  readonly registry = new WidgetRegistry();
  private readonly scene: Phaser.Scene;
  /** Not readonly: late/emulated touch (e.g. Chrome's device toolbar toggled
   * after boot) flips this reactively — see handlePointerDown. */
  private touchActive = isTouchDevice();
  private readonly health: HealthBarWidget;
  private readonly hotbar: HotbarWidget;
  private readonly buffs: BuffChipsWidget;
  private readonly weapon: WeaponChipWidget;
  private readonly chat: ChatPanelWidget;
  private readonly interaction: InteractionPromptWidget;
  private readonly connection: ConnectionStatusWidget;
  private readonly death: DeathOverlayWidget;
  private readonly reconnectToast: ReconnectToastWidget;
  private readonly inventory: InventoryWindowWidget;
  private readonly contacts: ContactsWindowWidget;
  private touchStick: TouchStickWidget | undefined;
  private touchButtons: TouchButtonsWidget | undefined;
  private inventoryToggleButton: InventoryToggleButtonWidget | undefined;

  constructor(scene: Phaser.Scene, viewport: Viewport, actions?: InventoryActions, social?: SocialActions) {
    this.scene = scene;
    if (this.touchActive) applyTouchLayoutOverrides(this.registry);
    const socialActions = social ?? noopSocialActions();
    this.health = new HealthBarWidget(scene, this.registry, viewport);
    this.hotbar = new HotbarWidget(scene, this.registry, viewport);
    this.buffs = new BuffChipsWidget(scene, this.registry, viewport);
    this.weapon = new WeaponChipWidget(scene, this.registry, viewport);
    this.chat = new ChatPanelWidget(scene, this.registry, viewport, socialActions.chat, this.touchActive);
    this.interaction = new InteractionPromptWidget(scene, this.registry, viewport);
    this.connection = new ConnectionStatusWidget(scene, this.registry, viewport);
    this.death = new DeathOverlayWidget(scene, this.registry, viewport);
    this.reconnectToast = new ReconnectToastWidget(scene, this.registry, viewport);
    this.inventory = new InventoryWindowWidget(scene, this.registry, viewport, actions ?? noopInventoryActions());
    this.contacts = new ContactsWindowWidget(scene, this.registry, viewport, socialActions.contacts);
    if (this.touchActive) this.buildTouchControls(scene, viewport);
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
  }

  private buildTouchControls(scene: Phaser.Scene, viewport: Viewport): void {
    this.touchStick = new TouchStickWidget(scene, this.registry, viewport);
    this.touchButtons = new TouchButtonsWidget(scene, this.registry, viewport);
    this.inventoryToggleButton = new InventoryToggleButtonWidget(scene, this.registry, viewport);
  }

  /**
   * Boot-time isTouchDevice() (checked once, above) is the fast path for real
   * touch hardware and the ?touch=1 override. It never runs again, so a browser
   * that only starts reporting touch after boot — Chrome's device toolbar
   * toggled mid-session, or any other late-arriving touch input — would
   * otherwise be stuck on the desktop layout with no touch controls forever.
   * This mounts controls + applies the touch layout live on the first touch
   * pointer event instead.
   */
  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.touchActive || !pointer.wasTouch) return;
    this.touchActive = true;
    applyTouchLayoutOverrides(this.registry);
    const viewport = { width: this.scene.scale.width, height: this.scene.scale.height };
    this.buildTouchControls(this.scene, viewport);
    this.resize(viewport);
  }

  /** Drives every widget from one fake/real snapshot; call once per frame. */
  update(snapshot: HudFakeSnapshot, nowMs: number): void {
    this.health.update(snapshot.health.hp, snapshot.health.maxHp, nowMs);
    this.hotbar.update(snapshot.hotbar, snapshot.selectedSlot, snapshot.armedThrowableSlot, nowMs);
    this.buffs.update(snapshot.buffs);
    this.weapon.update(snapshot.equippedWeaponId);
    this.inventory.update(snapshot.inventory, snapshot.equippedWeaponId);
    this.chat.update(snapshot.chatModel);
    this.contacts.update(snapshot.contacts);
    this.interaction.update(snapshot.interactionPrompt);
    this.connection.update(snapshot.pingMs, snapshot.connected, snapshot.fps, snapshot.coords);
    this.death.update(snapshot.downed);
    this.reconnectToast.update(snapshot.reconnecting, nowMs);
    if (snapshot.touch) {
      this.touchStick?.update(snapshot.touch.stick);
      this.touchButtons?.update(snapshot.touch.buttons);
    }
  }

  /** Re-resolves every widget's screen position for a new viewport (call on resize). */
  resize(viewport: Viewport): void {
    this.health.resize(this.registry, viewport);
    this.hotbar.resize(this.registry, viewport);
    this.buffs.resize(this.registry, viewport);
    this.weapon.resize(this.registry, viewport);
    this.inventory.resize(this.registry, viewport);
    this.contacts.resize(this.registry, viewport);
    this.chat.resize(this.registry, viewport);
    this.interaction.resize(this.registry, viewport);
    this.connection.resize(this.registry, viewport);
    this.death.resize(this.registry, viewport);
    this.reconnectToast.resize(this.registry, viewport);
    this.touchStick?.resize(this.registry, viewport);
    this.touchButtons?.resize(this.registry, viewport);
    this.inventoryToggleButton?.resize(this.registry, viewport);
  }

  /** Toggles the chat panel open/closed. */
  toggleChat(): void {
    this.chat.toggle();
  }

  /** Bound to [I]/[Tab] and the touch bag button (InputHooks.onToggleInventory). */
  toggleInventory(): void {
    this.inventory.toggle();
  }

  /** Bound to [Esc]'s InputPanels.closeAll sweep. */
  closeInventory(): void {
    this.inventory.close();
  }

  inventoryOpen(): boolean {
    return this.inventory.isOpen();
  }

  /** Bound to [o] and the chip beside the chat tabs (InputHooks.onToggleContacts). */
  toggleContacts(): void {
    this.contacts.toggle();
  }

  closeContacts(): void {
    this.contacts.close();
  }

  /** The row currently selected for the [1-9] bind flow (input/hotbar.ts's onNumberKey), or null. */
  selectedInventoryItem(): string | null {
    return this.inventory.selectedItem();
  }

  /** InputHud contract: which widget (if any) owns a screen point — the inventory panel,
   * contacts panel, chat panel (tabs/contacts chip/lines), hotbar slots, inventory toggle,
   * touch buttons, and the touch chat toggle chip, else null. */
  hitTest(screenX: number, screenY: number): string | null {
    if (this.inventory.hitTestPanel(screenX, screenY)) return "window:inventory";
    if (this.contacts.hitTestPanel(screenX, screenY)) return "window:contacts";
    if (this.chat.hitTestPanel(screenX, screenY)) return "window:chat";
    const slot = this.hotbar.hitTestSlot(screenX, screenY);
    if (slot !== null) return `slot:${slot}`;
    if (this.inventoryToggleButton?.hitTest(screenX, screenY)) return "inventory:toggle";
    const button = this.touchButtons?.hitTest(screenX, screenY);
    if (button) return `touch:${button}`;
    if (this.chat.hitTestToggle(screenX, screenY)) return "chat:toggle";
    return null;
  }
}
