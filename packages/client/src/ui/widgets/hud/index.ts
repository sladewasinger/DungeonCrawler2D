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
import { ChatPanelWidget } from "./chatPanel.js";
import { ConnectionStatusWidget } from "./connectionStatus.js";
import { DeathOverlayWidget } from "./deathOverlay.js";
import type { HudFakeSnapshot } from "./fakeData.js";
import { HealthBarWidget } from "./healthBar.js";
import { HotbarWidget } from "./hotbar.js";
import { InteractionPromptWidget } from "./interactionPrompt.js";
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
  // Clears the touch-buttons cluster's top edge (touchButtons.ts) instead of sitting
  // right on top of it — only reachable on the ?camera=entities gallery preset /
  // standing near a pickup in real play, but real play hits it too.
  registry.setOverride("interaction", { offset: { x: 0, y: -170 } });
}

export class HudWidgets {
  readonly registry = new WidgetRegistry();
  private readonly touchActive = isTouchDevice();
  private readonly health: HealthBarWidget;
  private readonly hotbar: HotbarWidget;
  private readonly buffs: BuffChipsWidget;
  private readonly weapon: WeaponChipWidget;
  private readonly chat: ChatPanelWidget;
  private readonly interaction: InteractionPromptWidget;
  private readonly connection: ConnectionStatusWidget;
  private readonly death: DeathOverlayWidget;
  private readonly reconnectToast: ReconnectToastWidget;
  private readonly touchStick: TouchStickWidget | undefined;
  private readonly touchButtons: TouchButtonsWidget | undefined;

  constructor(scene: Phaser.Scene, viewport: Viewport) {
    if (this.touchActive) applyTouchLayoutOverrides(this.registry);
    this.health = new HealthBarWidget(scene, this.registry, viewport);
    this.hotbar = new HotbarWidget(scene, this.registry, viewport);
    this.buffs = new BuffChipsWidget(scene, this.registry, viewport);
    this.weapon = new WeaponChipWidget(scene, this.registry, viewport);
    this.chat = new ChatPanelWidget(scene, this.registry, viewport, this.touchActive);
    this.interaction = new InteractionPromptWidget(scene, this.registry, viewport);
    this.connection = new ConnectionStatusWidget(scene, this.registry, viewport);
    this.death = new DeathOverlayWidget(scene, this.registry, viewport);
    this.reconnectToast = new ReconnectToastWidget(scene, this.registry, viewport);
    if (this.touchActive) {
      this.touchStick = new TouchStickWidget(scene, this.registry, viewport);
      this.touchButtons = new TouchButtonsWidget(scene, this.registry, viewport);
    }
  }

  /** Drives every widget from one fake/real snapshot; call once per frame. */
  update(snapshot: HudFakeSnapshot, nowMs: number): void {
    this.health.update(snapshot.health.hp, snapshot.health.maxHp, nowMs);
    this.hotbar.update(snapshot.hotbar, snapshot.selectedSlot, snapshot.armedThrowableSlot, nowMs);
    this.buffs.update(snapshot.buffs);
    this.weapon.update(snapshot.equippedWeaponId);
    this.chat.update(snapshot.chat, snapshot.activeChatChannel);
    this.interaction.update(snapshot.interactionPrompt);
    this.connection.update(snapshot.pingMs, snapshot.connected);
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
    this.chat.resize(this.registry, viewport);
    this.interaction.resize(this.registry, viewport);
    this.connection.resize(this.registry, viewport);
    this.death.resize(this.registry, viewport);
    this.reconnectToast.resize(this.registry, viewport);
    this.touchStick?.resize(this.registry, viewport);
    this.touchButtons?.resize(this.registry, viewport);
  }

  /** Toggles the chat panel open/closed. */
  toggleChat(): void {
    this.chat.toggle();
  }

  /** InputHud contract: which widget (if any) owns a screen point — hotbar slots,
   * touch buttons, and the chat toggle chip, else null. */
  hitTest(screenX: number, screenY: number): string | null {
    const slot = this.hotbar.hitTestSlot(screenX, screenY);
    if (slot !== null) return `slot:${slot}`;
    const button = this.touchButtons?.hitTest(screenX, screenY);
    if (button) return `touch:${button}`;
    if (this.chat.hitTestToggle(screenX, screenY)) return "chat:toggle";
    return null;
  }
}
