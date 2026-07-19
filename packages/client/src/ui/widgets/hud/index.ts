/**
 * HUD facade: registers every widget with a shared registry, owns their Phaser
 * instances, and drives per-frame updates from a HudFakeSnapshot (the gallery's
 * HUD-on state today; a live game wires the same update() from real net/inventory state).
 */
import type Phaser from "phaser";
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
import { WeaponChipWidget } from "./weaponChip.js";

export class HudWidgets {
  readonly registry = new WidgetRegistry();
  private readonly health: HealthBarWidget;
  private readonly hotbar: HotbarWidget;
  private readonly buffs: BuffChipsWidget;
  private readonly weapon: WeaponChipWidget;
  private readonly chat: ChatPanelWidget;
  private readonly interaction: InteractionPromptWidget;
  private readonly connection: ConnectionStatusWidget;
  private readonly death: DeathOverlayWidget;
  private readonly reconnectToast: ReconnectToastWidget;

  constructor(scene: Phaser.Scene, viewport: Viewport) {
    this.health = new HealthBarWidget(scene, this.registry, viewport);
    this.hotbar = new HotbarWidget(scene, this.registry, viewport);
    this.buffs = new BuffChipsWidget(scene, this.registry, viewport);
    this.weapon = new WeaponChipWidget(scene, this.registry, viewport);
    this.chat = new ChatPanelWidget(scene, this.registry, viewport);
    this.interaction = new InteractionPromptWidget(scene, this.registry, viewport);
    this.connection = new ConnectionStatusWidget(scene, this.registry, viewport);
    this.death = new DeathOverlayWidget(scene, this.registry, viewport);
    this.reconnectToast = new ReconnectToastWidget(scene, this.registry, viewport);
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
  }

  /** Toggles the chat panel open/closed. */
  toggleChat(): void {
    this.chat.toggle();
  }

  /** InputHud contract: which widget (if any) owns a screen point — "slot:N" for hotbar cells, else null. */
  hitTest(screenX: number, screenY: number): string | null {
    const slot = this.hotbar.hitTestSlot(screenX, screenY);
    return slot === null ? null : `slot:${slot}`;
  }
}
