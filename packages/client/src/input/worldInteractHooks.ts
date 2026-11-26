/** HUD action builders, settings mount, input wiring, and world-tap / [E] interaction handlers. */
import type { AudioEngine } from "../audio/audioEngine.js";
import type { WorldClient } from "../net/worldClient.js";
import { findManualLootInReach, resolveTapInteractTarget } from "../render/combat/lootViewHelpers.js";
import type { WorldScene } from "../render/world/worldScene.js";
import type { AtmosphereToolbar } from "../ui/atmosphereToolbar.js";
import type { ChatOverlay } from "../ui/chat/chatOverlay.js";
import type { DiscoveryOverlay } from "../ui/discovery/discoveryOverlay.js";
import { sealedVaultHint } from "../ui/discovery/poiPromptHelper.js";
import type { HudRoot } from "../ui/hud/hudRoot.js";
import type { HudActions } from "../ui/hud/slotRenderer.js";
import { SettingsMenu } from "../ui/settings/settingsMenu.js";
import { isLocalDebugOrigin, type SettingsPrefs } from "../ui/settings/settingsPrefs.js";
import { InputController } from "./controller.js";

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

export function tryTapWorldInteract(opts: {
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
  if (!manual) return false;
  client.pickupLoot(manual.id); audio.playUi("equip");
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

export function mountSettingsForUi(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient; readonly audio: AudioEngine;
  readonly toolbar: AtmosphereToolbar; readonly hud: HudRoot; readonly onReturnToTitle: () => void;
  readonly onCrouchMode?: (mode: "toggle" | "hold") => void;
}): SettingsMenu {
  const { host, scene, client, audio, toolbar, hud, onReturnToTitle, onCrouchMode } = opts;
  const settings = new SettingsMenu(host, {
    audio, isLocalDebug: isLocalDebugOrigin(), initialQuality: scene.qualityPreset(), initialZoom: scene.currentZoom(),
    onSetQuality: (q) => scene.setQualityPreset(q), onSetGoreLevel: (lvl) => scene.setGoreLevel(lvl),
    onZoom: (f) => { scene.adjustZoom(f); return scene.currentZoom(); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onRespawn: () => { client.respawn(); audio.playUi("open"); },
    onReturnToTitle: () => { hud.closePanels(); onReturnToTitle(); },
    onPrefsChange: (p) => applySettingsPrefs({ prefs: p, toolbar, scene, onCrouchMode }),
  });
  const prefs = settings.currentPrefs();
  scene.setZoom(prefs.cameraZoom); applySettingsPrefs({ prefs, toolbar, scene, onCrouchMode });
  settings.syncExternalState(scene.qualityPreset(), scene.currentZoom());
  return settings;
}

export function createClientInputHooks(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient; readonly hud: HudRoot;
  readonly chat: ChatOverlay; readonly discovery: DiscoveryOverlay; readonly audio: AudioEngine;
  readonly settings: SettingsMenu; readonly onInteractWorld: (lootId?: string) => void; readonly onCloseAll: () => void;
}): InputController {
  const { host, scene, client, hud, chat, discovery, audio, settings, onInteractWorld, onCloseAll } = opts;
  return new InputController(host, {
    onToggleTorch: () => { client.toggleTorch(); audio.playUi("click"); },
    onZoom: (f) => { scene.adjustZoom(f); settings.syncZoomPref(scene.currentZoom()); },
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onDropItem: () => { if (hud.dropShortcutItem()) audio.playUi("click"); },
    onToggleInventory: () => { hud.toggleInventory(); audio.playUi("open"); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onToggleMap: () => { hud.toggleMap(); audio.playUi("open"); },
    onInteract: () => onInteractWorld(),
    onOpenChat: () => chat.openInput(),
    onWorldTap: (cx, cy) => tryTapWorldInteract({ clientX: cx, clientY: cy, scene, client, hud, discovery, audio }),
    onClosePanels: onCloseAll,
  });
}