/** HUD action builders, settings mount, input wiring, and world-tap / [E] interaction handlers. */
import { ModalRouter } from "../app/modalRouter.js";
import type { AudioEngine } from "../audio/audioEngine.js";
import type { WorldClient } from "../net/worldClient.js";
import { findManualLootInReach, resolveTapInteractTarget } from "../render/combat/pickups/lootViewHelpers.js";
import type { WorldScene } from "../render/world/worldScene.js";
import type { AtmosphereToolbar } from "../ui/atmosphereToolbar.js";
import type { ChatOverlay } from "../ui/chat/chatOverlay.js";
import type { DiscoveryOverlay } from "../ui/discovery/discoveryOverlay.js";
import {
  findNearestDismantleableProp, resolveWorldInteractPrompt, sealedVaultHint,
} from "../ui/discovery/poiPromptHelper.js";
import type { HudRoot } from "../ui/hud/hudRoot.js";
import type { HudActions } from "../ui/hud/slotRenderer.js";
import { SettingsMenu } from "../ui/settings/settingsMenu.js";
import { isLocalDebugOrigin, type SettingsPrefs } from "../ui/settings/settingsPrefs.js";
import { InputController } from "./controller.js";
import { isTouchInputActive } from "./inputMode.js";

export function buildClientHudActions(client: WorldClient, audio: AudioEngine, toggleTorch: () => void): HudActions {
  return {
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onMoveSlot: (move) => client.moveSlot(move),
    onEquipArmor: (req) => { client.equipArmor(req); audio.playUi("equip"); },
    onUnequipArmor: (req) => { client.unequipArmor(req); audio.playUi("equip"); },
    onChestTransfer: (req) => {
      if (!req.chestId) return false;
      const ok = client.chestTransfer({ ...req, chestId: req.chestId });
      audio.playUi("click");
      return ok;
    },
    onChestTakeAll: (chestId) => {
      const ok = client.chestTakeAll(chestId);
      audio.playUi("equip");
      return ok;
    },
    onCraft: (recipeId) => { client.craftRecipe(recipeId); audio.playUi("craft"); },
    onDropItem: (req) => { client.dropItem(req); audio.playUi("click"); },
    onUseItem: (slot) => { client.useItem(slot); audio.playUi("equip"); },
    onSetCharacter: (req) => client.setCharacter(req),
    onToggleTorch: toggleTorch,
    onMapToggled: () => audio.playUi("open"),
  };
}

function tryTapWorldInteract(opts: {
  readonly clientX: number; readonly clientY: number; readonly scene: WorldScene;
  readonly client: WorldClient; readonly hud: HudRoot; readonly discovery: DiscoveryOverlay; readonly audio: AudioEngine;
}): void {
  const snap = opts.client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const hit = resolveTapInteractTarget({ chests: snap.chests, groundLoot: snap.groundLoot, world: opts.scene.screenToWorldTile(opts.clientX, opts.clientY), me });
  if (!hit) return;
  if (hit.kind !== "chest") { opts.client.pickupLoot(hit.id); opts.audio.playUi("equip"); return; }
  const targetChest = snap.chests.find((c) => c.id === hit.id);
  if (targetChest?.sealed) { opts.discovery.showNotice("Vault Sealed", sealedVaultHint(targetChest)); return; }
  opts.client.openChest(hit.id); opts.hud.openChest(hit.id); opts.audio.playUi("open");
}

function handleNearestChestInteract(opts: { readonly client: WorldClient; readonly hud: HudRoot; readonly discovery: DiscoveryOverlay; readonly audio: AudioEngine }): boolean {
  const near = opts.client.nearestChest();
  if (!near) return false;
  if (!near.sealed) {
    opts.client.openChest(near.id); opts.hud.openChest(near.id); opts.audio.playUi("open");
    return true;
  }
  opts.discovery.showNotice("Vault Sealed", sealedVaultHint(near));
  return false;
}

function handlePromptKindAction(opts: {
  readonly prompt: NonNullable<ReturnType<typeof resolveWorldInteractPrompt>>;
  readonly client: WorldClient; readonly hud: HudRoot; readonly audio: AudioEngine;
}): boolean {
  const { prompt, client, hud, audio } = opts;
  if (prompt.kind === "workbench" || prompt.kind === "campfire") { hud.toggleCrafting(); audio.playUi("open"); return true; }
  if (prompt.kind === "bed" && prompt.prop) { client.setRespawnBed(prompt.prop.id); audio.playUi("equip"); return true; }
  return false;
}

export function handleWorldInteract(opts: {
  readonly client: WorldClient; readonly hud: HudRoot; readonly discovery: DiscoveryOverlay;
  readonly audio: AudioEngine; readonly lootId?: string | undefined;
}): boolean {
  const { client, hud, audio, lootId } = opts;
  if (hud.activePanel() === "chest") { hud.closePanels(); return true; }
  if (lootId) { client.pickupLoot(lootId); audio.playUi("equip"); return true; }
  if (handleNearestChestInteract(opts)) return true;
  const snap = client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const manual = me ? findManualLootInReach(snap.groundLoot, me) : undefined;
  if (manual) { client.pickupLoot(manual.id); audio.playUi("equip"); return true; }
  const prompt = resolveWorldInteractPrompt({ nearestChest: undefined, nearestLoot: undefined, local: me, cache: snap.cache, touch: isTouchInputActive() });
  return prompt ? handlePromptKindAction({ prompt, client, hud, audio }) : false;
}

function handleWorldDismantle(opts: { readonly client: WorldClient; readonly audio: AudioEngine }): void {
  const snap = opts.client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const target = findNearestDismantleableProp(snap.cache, me);
  if (!target) return;
  opts.client.dismantleStructure(target.id);
  opts.audio.playUi("click");
}

function handlePlaceGhost(opts: {
  readonly scene: WorldScene; readonly client: WorldClient; readonly discovery: DiscoveryOverlay; readonly audio: AudioEngine;
}): boolean {
  const target = opts.scene.currentPlacementTarget();
  if (!target) return false;
  if (!target.valid) {
    opts.discovery.showNotice("Cannot Place", target.reason ?? "Blocked");
    return true;
  }
  opts.client.placeStructure({ itemId: target.itemId, x: target.x, y: target.y, rotation: target.rotation });
  opts.audio.playUi("equip");
  return true;
}

function applySettingsPrefs(opts: {
  readonly prefs: SettingsPrefs; readonly toolbar: AtmosphereToolbar;
  readonly scene: WorldScene; readonly onCrouchMode?: ((mode: "toggle" | "hold") => void) | undefined;
}): void {
  opts.toolbar.setFpsVisible(opts.prefs.showFps); opts.toolbar.setPingVisible(opts.prefs.showPing);
  if (opts.scene.qualityPreset() !== opts.prefs.quality) opts.scene.setQualityPreset(opts.prefs.quality);
  opts.scene.setShowHitboxes(opts.prefs.showHitboxes && isLocalDebugOrigin());
  opts.onCrouchMode?.(opts.prefs.crouchMode);
}

export function createOverworldModalRouter(opts: {
  readonly hud: HudRoot; readonly chat: ChatOverlay; readonly settings: SettingsMenu;
}): ModalRouter {
  const { hud, chat, settings } = opts;
  const router = new ModalRouter();
  const closeMap = () => { if (hud.isMapOpen()) hud.toggleMap(); };
  router.register("inventory", { isOpen: () => hud.activePanel() === "inventory", open: () => hud.toggleInventory(), close: () => hud.closePanels() });
  router.register("crafting", { isOpen: () => hud.activePanel() === "crafting", open: () => hud.toggleCrafting(), close: () => hud.closePanels() });
  router.register("character", { isOpen: () => hud.activePanel() === "character", open: () => hud.toggleCharacter(), close: () => hud.closePanels() });
  router.register("chest", { isOpen: () => hud.activePanel() === "chest", open: () => {}, close: () => hud.closePanels() });
  router.register("minimap", { isOpen: () => hud.isMapOpen(), open: () => hud.toggleMap(), close: closeMap });
  router.register("settings", { isOpen: () => settings.isOpen(), open: () => settings.setOpen(true), close: () => settings.setOpen(false) });
  router.register("chat", { isOpen: () => chat.isOpen(), open: () => chat.openInput(), close: () => chat.closeInput() });
  chat.setOpenListener((open) => { if (open) { hud.closePanels(); settings.setOpen(false); } });
  return router;
}

export function mountSettingsForUi(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient; readonly audio: AudioEngine;
  readonly toolbar: AtmosphereToolbar; readonly hud: HudRoot; readonly onReturnToTitle: () => void;
  readonly onCrouchMode?: (mode: "toggle" | "hold") => void; readonly onOpenChange?: (open: boolean) => void;
}): SettingsMenu {
  const { host, scene, client, audio, toolbar, hud, onReturnToTitle, onCrouchMode, onOpenChange } = opts;
  const settings = new SettingsMenu(host, {
    audio, isLocalDebug: isLocalDebugOrigin(), initialQuality: scene.qualityPreset(), initialZoom: scene.currentZoom(),
    onSetQuality: (q) => scene.setQualityPreset(q), onSetGoreLevel: (lvl) => scene.setGoreLevel(lvl),
    onZoom: (f) => { scene.adjustZoom(f); return scene.currentZoom(); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onRespawn: () => { client.respawn(); audio.playUi("open"); },
    onReturnToTitle: () => { hud.closePanels(); onReturnToTitle(); },
    onResetLocalWorld: () => { client.resetOfflineWorld(); hud.closePanels(); audio.playUi("open"); },
    onPrefsChange: (p) => applySettingsPrefs({ prefs: p, toolbar, scene, onCrouchMode }),
    onOpenChange,
  });
  const prefs = settings.currentPrefs();
  scene.setZoom(prefs.cameraZoom); applySettingsPrefs({ prefs, toolbar, scene, onCrouchMode });
  settings.syncExternalState(scene.qualityPreset(), scene.currentZoom());
  return settings;
}

export function createClientInputHooks(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient; readonly hud: HudRoot;
  readonly discovery: DiscoveryOverlay; readonly audio: AudioEngine; readonly settings: SettingsMenu;
  readonly modals: ModalRouter; readonly onInteractWorld: (lootId?: string) => void;
}): InputController {
  const { host, scene, client, hud, discovery, audio, settings, modals, onInteractWorld } = opts;
  return new InputController(host, {
    onToggleTorch: () => { client.toggleTorch(); audio.playUi("click"); },
    onZoom: (f) => { scene.adjustZoom(f); settings.syncZoomPref(scene.currentZoom()); },
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onDropItem: () => { if (hud.dropShortcutItem()) audio.playUi("click"); },
    onToggleInventory: () => { modals.toggle("inventory"); audio.playUi("open"); },
    onToggleCharacter: () => { modals.toggle("character"); audio.playUi("open"); },
    onToggleMap: () => { modals.toggle("minimap"); audio.playUi("open"); },
    onInteract: () => onInteractWorld(),
    onDismantle: () => handleWorldDismantle({ client, audio }),
    onRotateGhost: () => { scene.cyclePlacementRotation(); audio.playUi("click"); },
    onPlaceGhost: () => handlePlaceGhost({ scene, client, discovery, audio }),
    onOpenChat: () => modals.open("chat"),
    onWorldTap: (cx, cy) => tryTapWorldInteract({ clientX: cx, clientY: cy, scene, client, hud, discovery, audio }),
    onClosePanels: () => { modals.closeAll(); },
  });
}