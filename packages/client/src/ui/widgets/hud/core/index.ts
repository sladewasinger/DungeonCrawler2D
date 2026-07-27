/* eslint-disable max-lines -- HUD composition intentionally centralizes widget ownership. */
import type Phaser from "phaser";
import { inputModality, type InputModality } from "../../../../input/controls/inputModality.js";
import { HudEditMode } from "../../../hudEdit/index.js";
import { WidgetRegistry } from "../../registry.js";
import type { Viewport } from "../../state.js";
import { noopSocialActions, type SocialActions, type StationActions } from "./actionBundles.js";
import { BuffChipsWidget } from "./buffChips.js";
import { ChatPanelWidget } from "../social/chatPanel.js";
import { CompassWidget } from "./compass.js";
import { ConnectionStatusWidget } from "../notices/connectionStatus.js";
import { DeathOverlayWidget } from "../notices/deathOverlay.js";
import type { HudFakeSnapshot } from "./fakeData.js";
import { HealthBarWidget } from "../bars/healthBar.js";
import { HotbarWidget } from "../inventory/hotbar.js";
import { InteractionPromptWidget } from "./interactionPrompt.js";
import type { InventoryActions } from "../inventory/inventoryWindow.js";
import { PanelWindows, shouldDismissOnOutsideTap } from "../windows/panelWindows.js";
import { PartyFramesWidget } from "../social/partyFrames.js";
import { ReconnectToastWidget } from "../notices/reconnectToast.js";
import { StaminaBarWidget } from "../bars/staminaBar.js";
import { ToastStackWidget } from "../notices/toastStack.js";
import { TouchHudControls } from "../touch/touchControls.js";
import { applyTouchLayoutOverrides, captureTouchLayoutOverrides, restoreTouchLayoutOverrides, type TouchLayoutSnapshot, } from "../touch/touchOverrides.js";
import { WeaponChipWidget } from "./weaponChip.js";
import { XpBarWidget } from "../bars/xpBar.js";
export type { SocialActions, StationActions } from "./actionBundles.js";
function initializeHudRegistry(registry: WidgetRegistry, viewport: Viewport, touchActive: boolean): TouchLayoutSnapshot | undefined { registry.loadPersisted();
if (!touchActive)
    return undefined;
const snapshot = captureTouchLayoutOverrides(registry);
applyTouchLayoutOverrides(registry, viewport);
return snapshot;
}
function createConnectionWidget(request: {
    scene: Phaser.Scene;
    registry: WidgetRegistry;
    viewport: Viewport;
    touchActive: boolean;
}): ConnectionStatusWidget | undefined { return request.touchActive ? undefined : new ConnectionStatusWidget(request.scene, request.registry, request.viewport);
}
export interface HudWidgetsOptions {
    scene: Phaser.Scene;
    viewport: Viewport;
    actions?: InventoryActions;
    social?: SocialActions;
    stations?: StationActions;
    onRespawnNow?: () => void;
}
export class HudWidgets {
    readonly registry = new WidgetRegistry();
    private readonly scene: Phaser.Scene;
    private touchActive = inputModality.current === "touch";
    private touchLayoutSnapshot: TouchLayoutSnapshot | undefined;
    private readonly stopModality: () => void;
    private readonly health: HealthBarWidget;
    private readonly stamina: StaminaBarWidget;
    private readonly hotbar: HotbarWidget;
    private readonly buffs: BuffChipsWidget;
    private readonly weapon: WeaponChipWidget;
    private readonly xpBar: XpBarWidget;
    private readonly chat: ChatPanelWidget;
    private readonly interaction: InteractionPromptWidget;
    private readonly connection: ConnectionStatusWidget | undefined;
    private readonly compass: CompassWidget;
    private readonly death: DeathOverlayWidget;
    private readonly reconnectToast: ReconnectToastWidget;
    private readonly toasts: ToastStackWidget;
    private readonly panels: PanelWindows;
    private readonly party: PartyFramesWidget;
    private readonly touchControls: TouchHudControls;
    private readonly editMode: HudEditMode;
    private viewport: Viewport;
    constructor({ scene, viewport, actions, social, stations, onRespawnNow }: HudWidgetsOptions) { this.scene = scene;
this.viewport = viewport;
this.touchLayoutSnapshot = initializeHudRegistry(this.registry, viewport, this.touchActive);
const socialActions = social ?? noopSocialActions();
this.health = new HealthBarWidget(scene, this.registry, viewport);
this.stamina = new StaminaBarWidget(scene, this.registry, viewport);
this.hotbar = new HotbarWidget(scene, this.registry, viewport);
this.buffs = new BuffChipsWidget(scene, this.registry, viewport);
this.weapon = new WeaponChipWidget(scene, this.registry, viewport);
this.xpBar = new XpBarWidget(scene, this.registry, viewport);
this.chat = new ChatPanelWidget({ scene, registry: this.registry, viewport, actions: socialActions.chat, collapsedDefault: this.touchActive });
this.interaction = new InteractionPromptWidget(scene, this.registry, viewport);
this.connection = createConnectionWidget({ scene, registry: this.registry, viewport, touchActive: this.touchActive });
this.compass = new CompassWidget(scene, this.registry, viewport);
this.death = new DeathOverlayWidget({ scene, registry: this.registry, viewport, ...(onRespawnNow ? { onGiveUp: onRespawnNow } : {}) });
this.reconnectToast = new ReconnectToastWidget(scene, this.registry, viewport);
this.toasts = new ToastStackWidget(scene, this.registry, viewport);
this.panels = new PanelWindows({ scene, registry: this.registry, viewport, ...(actions ? { actions } : {}), ...(social ? { social } : {}), ...(stations ? { stations } : {}), });
this.party = new PartyFramesWidget(scene, this.registry, viewport);
this.touchControls = new TouchHudControls(scene, this.registry);
if (this.touchActive)
        this.touchControls.mount(viewport);
this.editMode = new HudEditMode({ scene, registry: this.registry, viewport, onLayoutChanged: () => this.resize(this.viewport) });
scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
this.stopModality = inputModality.subscribe((mode) => this.applyModality(mode));
scene.events.once("shutdown", this.stopModality);
}
    private handlePointerDown(pointer: Phaser.Input.Pointer): void { if (pointer.wasTouch)
        inputModality.noteTouch(this.scene.time.now);
}
    private applyModality(mode: InputModality): void { const touchActive = mode === "touch";
if (touchActive === this.touchActive)
        return;
this.touchActive = touchActive;
if (touchActive) {
        this.touchLayoutSnapshot = captureTouchLayoutOverrides(this.registry);
        applyTouchLayoutOverrides(this.registry, this.viewport);
        this.touchControls.mount(this.viewport);
    }
    else {
        if (this.touchLayoutSnapshot) {
            restoreTouchLayoutOverrides(this.registry, this.touchLayoutSnapshot);
            this.touchLayoutSnapshot = undefined;
        }
        this.touchControls.unmount();
    } this.resize(this.viewport);
}
    update(snapshot: HudFakeSnapshot, nowMs: number): void { this.health.update(snapshot.health.hp, snapshot.health.maxHp, nowMs);
this.stamina.update(snapshot.stamina.stamina, snapshot.stamina.maxStamina, snapshot.stamina.blocking);
this.hotbar.update({ slotsData: snapshot.hotbar, selectedSlot: snapshot.selectedSlot, armedThrowableSlot: snapshot.armedThrowableSlot, nowMs });
this.buffs.update(snapshot.buffs);
this.weapon.update(snapshot.equippedWeaponId, nowMs);
this.xpBar.update(snapshot.xp, snapshot.floor);
this.panels.update({ inventory: snapshot.inventory, weaponId: snapshot.equippedWeaponId, contacts: snapshot.contacts, craft: snapshot.craft, stash: snapshot.stash, lastToast: snapshot.lastToast, nowMs });
this.chat.update(snapshot.chatModel);
this.party.update(snapshot.party, snapshot.partySelfLeader);
this.interaction.update(snapshot.interactionPrompt);
this.connection?.update({ pingMs: snapshot.pingMs, connected: snapshot.connected, fpsSample: snapshot.fps, coords: snapshot.coords, seed: snapshot.seed, floor: snapshot.floor, biome: snapshot.biome, headingDeg: snapshot.headingDeg });
this.compass.update(snapshot.compassBearingDeg, snapshot.stairway, nowMs);
this.death.update({ downed: snapshot.downed, dead: snapshot.dead, remainingSec: snapshot.respawnRemainingSec, holdProgress: snapshot.giveUpHoldProgress, downedRemainingSec: snapshot.downedRemainingSec, reviveProgress: snapshot.reviveProgress, reviverName: snapshot.reviverName });
this.reconnectToast.update(snapshot.reconnecting, nowMs, snapshot.reconnectAttempts);
this.toasts.update(snapshot.toasts, nowMs);
this.touchControls.update(snapshot.touch, nowMs);
}
    resize(viewport: Viewport): void { this.viewport = viewport;
if (this.touchActive)
        applyTouchLayoutOverrides(this.registry, viewport);
this.health.resize(this.registry, viewport);
this.stamina.resize(this.registry, viewport);
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
    toggleChat(): void { this.chat.toggle();
}
    toggleInventory(): void { this.panels.toggleInventory();
}
    closeInventory(): void { this.panels.closeInventory();
}
    inventoryOpen(): boolean { return this.panels.inventoryOpen();
}
    toggleContacts(): void { this.panels.toggleContacts();
}
    closeContacts(): void { this.panels.closeContacts();
}
    selectedInventoryItem(): string | null { return this.panels.selectedInventoryItem();
}
    craftOpen(): boolean { return this.panels.craftOpen();
}
    toggleCraftPanel(): void { this.panels.toggleCraft();
}
    closeCraftPanel(): void { this.panels.closeCraft();
}
    stashOpen(): boolean { return this.panels.stashOpen();
}
    openStashPanel(): void { this.panels.openStash();
}
    closeStashPanel(): void { this.panels.closeStash();
}
    hitTest(screenX: number, screenY: number): string | null { if (this.editMode.active)
        return "window:hud-edit";
const windowHit = this.hitTestWindows(screenX, screenY);
if (windowHit)
        return windowHit;
if (shouldDismissOnOutsideTap(this.touchActive, this.panels.anyOpen())) {
        this.panels.closeAll();
        return "window:dismissed";
    } return null;
}
    hitTestTouchOnly(screenX: number, screenY: number): string | null { return this.touchControls.hitTest(screenX, screenY);
}
    private hitTestWindows(screenX: number, screenY: number): string | null { const panelHit = this.panels.hitTest(screenX, screenY);
if (panelHit)
        return panelHit;
if (this.chat.hitTestPanel(screenX, screenY))
        return "window:chat";
const slot = this.hotbar.hitTestSlot(screenX, screenY);
if (slot !== null)
        return `slot:${slot}`;
const touchHit = this.hitTestTouchOnly(screenX, screenY);
if (touchHit)
        return touchHit;
if (this.chat.hitTestToggle(screenX, screenY))
        return "chat:toggle";
return null;
}
}
