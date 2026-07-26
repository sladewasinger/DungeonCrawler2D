/**
 * HUD facade: registers every widget with a shared registry, owns their Phaser
 * instances, and drives per-frame updates from a HudFakeSnapshot (the gallery's
 * HUD-on state today; a live game wires the same update() from real net/inventory state).
 */
import type Phaser from "phaser";
import { inputModality, type InputModality } from "../../../input/inputModality.js";
import { HudEditMode } from "../../hudEdit/index.js";
import { WidgetRegistry } from "../registry.js";
import type { Viewport } from "../state.js";
import { noopSocialActions, type SocialActions, type StationActions } from "./actionBundles.js";
import { BuffChipsWidget } from "./buffChips.js";
import { ChatPanelWidget } from "./chatPanel.js";
import { CompassWidget } from "./compass.js";
import { ConnectionStatusWidget } from "./connectionStatus.js";
import { DeathOverlayWidget } from "./deathOverlay.js";
import type { HudFakeSnapshot } from "./fakeData.js";
import { HealthBarWidget } from "./healthBar.js";
import { HotbarWidget } from "./hotbar.js";
import { InteractionPromptWidget } from "./interactionPrompt.js";
import type { InventoryActions } from "./inventoryWindow.js";
import { PanelWindows, shouldDismissOnOutsideTap } from "./panelWindows.js";
import { PartyFramesWidget } from "./partyFrames.js";
import { ReconnectToastWidget } from "./reconnectToast.js";
import { StaminaBarWidget } from "./staminaBar.js";
import { ToastStackWidget } from "./toastStack.js";
import { TouchHudControls } from "./touchControls.js";
import {
  applyTouchLayoutOverrides,
  captureTouchLayoutOverrides,
  restoreTouchLayoutOverrides,
  type TouchLayoutSnapshot,
} from "./touchOverrides.js";
import { WeaponChipWidget } from "./weaponChip.js";
import { XpBarWidget } from "./xpBar.js";

export type { SocialActions, StationActions } from "./actionBundles.js";

export class HudWidgets {
  readonly registry = new WidgetRegistry();
  private readonly scene: Phaser.Scene;
  private touchActive = inputModality.current === "touch";
  private touchLayoutSnapshot: TouchLayoutSnapshot | undefined;
  private readonly stopModality: () => void;
  private readonly health: HealthBarWidget; private readonly stamina: StaminaBarWidget;
  private readonly hotbar: HotbarWidget; private readonly buffs: BuffChipsWidget; private readonly weapon: WeaponChipWidget;
  /** XP progress + level numeral (Epic 11 core, pulled forward). */
  private readonly xpBar: XpBarWidget;
  private readonly chat: ChatPanelWidget;
  private readonly interaction: InteractionPromptWidget;
  /** The ping/fps/coords/seed/build telemetry stack — undefined on touch (never even
   * built there; the judge-panel finding was it physically covers the mobile attack
   * button). Desktop still starts it hidden internally, toggled by its own [F3] bind. */
  private readonly connection: ConnectionStatusWidget | undefined;
  /** LANE W2: which world direction currently renders at screen-up (scenes/dungeon/rotationControl.ts). */
  private readonly compass: CompassWidget;
  private readonly death: DeathOverlayWidget; private readonly reconnectToast: ReconnectToastWidget; private readonly toasts: ToastStackWidget;
  /** inventory/contacts/craft/stash — the four centered window panels (panelWindows.ts). */
  private readonly panels: PanelWindows;
  /** Off-self party member rows (Epic 7.12) — hidden entirely when unpartied. */
  private readonly party: PartyFramesWidget;
  private readonly touchControls: TouchHudControls;
  /** Edit-HUD mode (docs/HUD_OS.md Phase 2) — gear chip + [F10], drag-to-move, catalog panel. */
  private readonly editMode: HudEditMode;
  private viewport: Viewport;

  constructor(scene: Phaser.Scene, viewport: Viewport, actions?: InventoryActions, social?: SocialActions, stations?: StationActions) {
    this.scene = scene;
    this.viewport = viewport;
    // Closes the HUD_OS.md Phase 2 prerequisite gap: a saved edit-HUD layout previously had
    // no effect on a real boot. Runs before applyTouchLayoutOverrides so a touch profile still
    // wins over a desktop-saved layout on the fields it touches (docs/HUD_OS.md §6, "Touch-layout
    // overrides interaction" — different physical device, different constraints).
    this.registry.loadPersisted();
    if (this.touchActive) {
      this.touchLayoutSnapshot = captureTouchLayoutOverrides(this.registry);
      applyTouchLayoutOverrides(this.registry, viewport);
    }
    const socialActions = social ?? noopSocialActions();
    this.health = new HealthBarWidget(scene, this.registry, viewport); this.stamina = new StaminaBarWidget(scene, this.registry, viewport);
    this.hotbar = new HotbarWidget(scene, this.registry, viewport);
    this.buffs = new BuffChipsWidget(scene, this.registry, viewport);
    this.weapon = new WeaponChipWidget(scene, this.registry, viewport);
    this.xpBar = new XpBarWidget(scene, this.registry, viewport);
    this.chat = new ChatPanelWidget(scene, this.registry, viewport, socialActions.chat, this.touchActive);
    this.interaction = new InteractionPromptWidget(scene, this.registry, viewport);
    this.connection = this.touchActive ? undefined : new ConnectionStatusWidget(scene, this.registry, viewport);
    this.compass = new CompassWidget(scene, this.registry, viewport);
    this.death = new DeathOverlayWidget(scene, this.registry, viewport);
    this.reconnectToast = new ReconnectToastWidget(scene, this.registry, viewport);
    this.toasts = new ToastStackWidget(scene, this.registry, viewport);
    this.panels = new PanelWindows(scene, this.registry, viewport, actions, social, stations);
    this.party = new PartyFramesWidget(scene, this.registry, viewport);
    this.touchControls = new TouchHudControls(scene, this.registry);
    if (this.touchActive) this.touchControls.mount(viewport);
    // Constructed last so its drag handles reflect every widget registered above.
    this.editMode = new HudEditMode(scene, this.registry, viewport, () => this.resize(this.viewport));
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.stopModality = inputModality.subscribe((mode) => this.applyModality(mode));
    scene.events.once("shutdown", this.stopModality);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) inputModality.noteTouch(this.scene.time.now);
  }

  private applyModality(mode: InputModality): void {
    const touchActive = mode === "touch";
    if (touchActive === this.touchActive) return;
    this.touchActive = touchActive;
    if (touchActive) {
      this.touchLayoutSnapshot = captureTouchLayoutOverrides(this.registry);
      applyTouchLayoutOverrides(this.registry, this.viewport);
      this.touchControls.mount(this.viewport);
    } else {
      if (this.touchLayoutSnapshot) {
        restoreTouchLayoutOverrides(this.registry, this.touchLayoutSnapshot);
        this.touchLayoutSnapshot = undefined;
      }
      this.touchControls.unmount();
    }
    this.resize(this.viewport);
  }

  /** Drives every widget from one fake/real snapshot; call once per frame. */
  update(snapshot: HudFakeSnapshot, nowMs: number): void {
    this.health.update(snapshot.health.hp, snapshot.health.maxHp, nowMs); this.stamina.update(snapshot.stamina.stamina, snapshot.stamina.maxStamina, snapshot.stamina.blocking);
    this.hotbar.update(snapshot.hotbar, snapshot.selectedSlot, snapshot.armedThrowableSlot, nowMs);
    this.buffs.update(snapshot.buffs);
    this.weapon.update(snapshot.equippedWeaponId, nowMs);
    this.xpBar.update(snapshot.xp, snapshot.floor);
    this.panels.update(snapshot.inventory, snapshot.equippedWeaponId, snapshot.contacts, snapshot.craft, snapshot.stash, snapshot.lastToast, nowMs);
    this.chat.update(snapshot.chatModel);
    this.party.update(snapshot.party, snapshot.partySelfLeader);
    this.interaction.update(snapshot.interactionPrompt);
    this.connection?.update(snapshot.pingMs, snapshot.connected, snapshot.fps, snapshot.coords, snapshot.seed, snapshot.floor, snapshot.biome, snapshot.headingDeg);
    this.compass.update(snapshot.compassBearingDeg, snapshot.stairway, nowMs); this.death.update(snapshot.downed, snapshot.dead, snapshot.respawnRemainingSec, snapshot.respawnHoldProgress);
    this.reconnectToast.update(snapshot.reconnecting, nowMs, snapshot.reconnectAttempts);
    this.toasts.update(snapshot.toasts, nowMs);
    this.touchControls.update(snapshot.touch, nowMs);
  }

  /** Re-resolves every widget's screen position for a new viewport (call on resize). */
  resize(viewport: Viewport): void {
    this.viewport = viewport;
    // Recomputed on every resize (not just first touch) so an orientation flip — the
    // narrow axis swapping from width to height — re-derives the narrow-viewport shrink
    // factor instead of freezing whatever the boot/first-touch viewport happened to be.
    if (this.touchActive) applyTouchLayoutOverrides(this.registry, viewport);
    this.health.resize(this.registry, viewport); this.stamina.resize(this.registry, viewport);
    this.hotbar.resize(this.registry, viewport);
    this.buffs.resize(this.registry, viewport);
    this.weapon.resize(this.registry, viewport);
    this.xpBar.resize(this.registry, viewport);
    this.panels.resize(this.registry, viewport);
    this.chat.resize(this.registry, viewport);
    this.party.resize(this.registry, viewport);
    this.interaction.resize(this.registry, viewport);
    this.connection?.resize(this.registry, viewport);
    this.compass.resize(this.registry, viewport);
    this.death.resize(this.registry, viewport);
    this.reconnectToast.resize(this.registry, viewport);
    this.toasts.resize(this.registry, viewport);
    this.touchControls.resize(viewport);
    this.editMode.resize(viewport);
  }

  /** Toggles the chat panel open/closed. */
  toggleChat(): void {
    this.chat.toggle();
  }

  /** Bound to [I]/[Tab] and the touch bag button (InputHooks.onToggleInventory). */
  toggleInventory(): void {
    this.panels.toggleInventory();
  }

  /** Bound to [Esc]'s InputPanels.closeAll sweep. */
  closeInventory(): void {
    this.panels.closeInventory();
  }

  inventoryOpen(): boolean {
    return this.panels.inventoryOpen();
  }

  /** Bound to [o] and the chip beside the chat tabs (InputHooks.onToggleContacts). */
  toggleContacts(): void {
    this.panels.toggleContacts();
  }

  closeContacts(): void {
    this.panels.closeContacts();
  }

  /** The row currently selected for the [1-9] bind flow (input/hotbar.ts's onNumberKey), or null. */
  selectedInventoryItem(): string | null {
    return this.panels.selectedInventoryItem();
  }

  /** PanelSource contract (scenes/dungeon/panelAdapters.ts) — [C] near a table toggles open/closed. */
  craftOpen(): boolean {
    return this.panels.craftOpen();
  }

  toggleCraftPanel(): void {
    this.panels.toggleCraft();
  }

  /** [Esc]'s InputPanels.closeAll sweep. */
  closeCraftPanel(): void {
    this.panels.closeCraft();
  }

  /** PanelSource contract — [E] near a stash opens it (never toggles closed; matches v1). */
  stashOpen(): boolean {
    return this.panels.stashOpen();
  }

  openStashPanel(): void {
    this.panels.openStash();
  }

  /** [Esc]'s InputPanels.closeAll sweep. */
  closeStashPanel(): void {
    this.panels.closeStash();
  }

  /** InputHud contract: which widget (if any) owns a screen point — the four window panels
   * (panelWindows.ts), chat panel (tabs/contacts chip/lines), hotbar slots, inventory
   * toggle, touch buttons, and the touch chat toggle chip, else null. */
  hitTest(screenX: number, screenY: number): string | null {
    // Edit-HUD mode suspends normal gameplay input (docs/HUD_OS.md §3) — claim every
    // click while it's active so a drag or catalog toggle never also swings a weapon.
    if (this.editMode.active) return "window:hud-edit";
    const windowHit = this.hitTestWindows(screenX, screenY);
    if (windowHit) return windowHit;
    // Touch has no [Esc] — a tap that hit nothing above but landed while a window is open
    // dismisses it instead of falling through to a world action, mirroring a modal's
    // tap-outside-to-close. Consumed (non-null) so pointer.ts's swing/joystick fallback
    // never also fires from the same tap; the string itself maps to no handleUiHit case.
    if (shouldDismissOnOutsideTap(this.touchActive, this.panels.anyOpen())) {
      this.panels.closeAll();
      return "window:dismissed";
    }
    return null;
  }

  /** Keeps only the legacy touch-control hit regions while the visible HUD is DOM-rendered. */
  hitTestTouchOnly(screenX: number, screenY: number): string | null {
    return this.touchControls.hitTest(screenX, screenY);
  }

  /** hitTest()'s ordinary (non-edit-mode) dispatch chain, split out to stay under the
   * complexity cap once edit-mode's own branch is folded into the caller above. */
  private hitTestWindows(screenX: number, screenY: number): string | null {
    const panelHit = this.panels.hitTest(screenX, screenY);
    if (panelHit) return panelHit;
    if (this.chat.hitTestPanel(screenX, screenY)) return "window:chat";
    const slot = this.hotbar.hitTestSlot(screenX, screenY);
    if (slot !== null) return `slot:${slot}`;
    const touchHit = this.hitTestTouchOnly(screenX, screenY);
    if (touchHit) return touchHit;
    if (this.chat.hitTestToggle(screenX, screenY)) return "chat:toggle";
    return null;
  }
}
