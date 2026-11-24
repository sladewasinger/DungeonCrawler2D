/** Client boot entry: mounts PixiJS v8 shader scene, Web Audio engine, networking, input, and HUD. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { installAdminConsole } from "./admin/adminConsole.js";
import { AudioEngine } from "./audio/audioEngine.js";
import {
  EntityVelocityTracker, isTouchViewport, resolveMobileBowAutoAim, resolveMobileMeleeAutoAim,
} from "./input/autoAim.js";
import { InputController, type CombatInputsFrame } from "./input/controller.js";
import { WorldClient, type WorldViewState } from "./net/worldClient.js";
import { findManualLootInReach, resolveTapInteractTarget } from "./render/combat/lootViewHelpers.js";
import { preloadSpriteManifest } from "./render/textures/spriteManifest.js";
import { WorldScene } from "./render/world/worldScene.js";
import { bootAssetSandbox } from "./sandbox/sandboxMode.js";
import { AtmosphereToolbar } from "./ui/atmosphereToolbar.js";
import { installMobileAutoFullscreen } from "./ui/fullscreen.js";
import { HudRoot } from "./ui/hud/hudRoot.js";
import type { HudActions } from "./ui/hud/slotRenderer.js";
import { CombatFeedbackOverlay } from "./ui/overlays/combatFeedbackOverlay.js";
import { SettingsMenu } from "./ui/settings/settingsMenu.js";
import { isLocalDebugOrigin } from "./ui/settings/settingsPrefs.js";
import { isLocalhostOrigin, TitleScreen } from "./ui/title/titleScreen.js";

interface AppCtx {
  readonly scene: WorldScene; readonly client: WorldClient; readonly input: InputController;
  readonly toolbar: AtmosphereToolbar; readonly hud: HudRoot; readonly feedback: CombatFeedbackOverlay;
  readonly audio: AudioEngine; readonly settings: SettingsMenu; readonly velTracker: EntityVelocityTracker; readonly titleScreen: TitleScreen;
}

function resolveMouseAim(ctx: AppCtx & { readonly nowMs: number }): { readonly x: number; readonly y: number } | undefined {
  const mouse = ctx.input.mouseAim(ctx.nowMs);
  if (!mouse) return undefined;
  const me = ctx.client.localPose();
  const target = ctx.scene.screenToWorldTile(mouse.x, mouse.y);
  const dx = target.x - me.x;
  const dy = target.y - (me.y - me.elevation * 0.625 - 0.52);
  const mag = Math.hypot(dx, dy);
  return mag > 0.05 ? { x: dx / mag, y: dy / mag } : undefined;
}

function hasPlayerCombatPose(local?: PlayerSnapshot): boolean {
  return Boolean(local && ((local.swingProgress ?? 0) > 0 || (local.heavyCharge ?? 0) > 0 || (local.bowCharge ?? 0) > 0.001));
}

function wantsCombatAim(combat: CombatInputsFrame, local?: PlayerSnapshot): boolean {
  return combat.attack || combat.attackHold || combat.bowDraw || combat.bowRelease || hasPlayerCombatPose(local);
}

function resolveTouchMeleeSnap(opts: {
  readonly combat: CombatInputsFrame; readonly move: { readonly x: number; readonly y: number };
  readonly local?: PlayerSnapshot | undefined; readonly entities: readonly WorldEntitySnapshot[];
}): { readonly x: number; readonly y: number } | undefined {
  const { local, combat, move, entities } = opts;
  if (!local || !combat.attack || local.heldItem === "bow" || !isTouchViewport()) return undefined;
  const facing = Math.hypot(move.x, move.y) > 0.05 ? move : { x: local.facingX, y: local.facingY };
  return resolveMobileMeleeAutoAim({ local, entities, facing });
}

function resolveAimForTick(opts: {
  readonly ctx: AppCtx & { readonly nowMs: number }; readonly combat: CombatInputsFrame;
  readonly move: { readonly x: number; readonly y: number }; readonly local?: PlayerSnapshot | undefined;
  readonly entities: readonly WorldEntitySnapshot[];
}): { readonly x: number; readonly y: number } | undefined {
  const autoOn = opts.ctx.settings.currentPrefs().autoAim;
  if (opts.combat.mobileAim) {
    return autoOn && opts.local
      ? resolveMobileBowAutoAim({ aim: opts.combat.mobileAim, local: opts.local, entities: opts.entities, tracker: opts.ctx.velTracker })
      : opts.combat.mobileAim;
  }
  const snap = autoOn ? resolveTouchMeleeSnap(opts) : undefined;
  if (snap) return snap;
  return Math.hypot(opts.move.x, opts.move.y) <= 0.05 || wantsCombatAim(opts.combat, opts.local) ? resolveMouseAim(opts.ctx) : undefined;
}

function syncUiAndAudio(opts: {
  readonly ctx: AppCtx; readonly view: WorldViewState;
  readonly events: WorldViewState["events"]; readonly dt: number;
  readonly dists: { readonly campfireDist: number; readonly waterDist: number };
}): void {
  const { ctx, view, events, dists } = opts;
  const local = view.players.find((p) => p.id === view.localPlayerId);
  ctx.audio.handleWorldEvents(events, local ? { x: local.x, y: local.y } : { x: 0.5, y: 0.5 });
  ctx.audio.stepFrame({ local, cache: view.cache, dt: opts.dt, dayPhase: view.dayPhase, ...dists });
  ctx.hud.sync({ inventory: view.inventory, name: view.localName, appearance: view.localAppearance, localPlayer: local, cache: view.cache, players: view.players, entities: view.entities, chests: view.chests });
  ctx.feedback.sync({ local, events, localId: view.localPlayerId, dt: opts.dt });
  ctx.toolbar.sync({ mode: view.mode, dayPhase: view.dayPhase, dayPaused: view.dayPaused, quality: ctx.scene.qualityPreset(), activePanel: ctx.hud.activePanel(), settingsOpen: ctx.settings.isOpen(), playerX: local?.x ?? 0, playerY: local?.y ?? 0 });
  ctx.settings.syncExternalState(ctx.scene.qualityPreset(), ctx.scene.currentZoom());
}

function renderTick(ctx: AppCtx & { readonly nowMs: number; readonly dt: number }): void {
  ctx.toolbar.tickFps(ctx.nowMs);
  const pre = ctx.client.snapshot();
  if (ctx.titleScreen.isOpen()) {
    ctx.client.stepInput({ move: { x: 0, y: 0 }, dt: ctx.dt });
    const idle = ctx.client.snapshot();
    ctx.scene.renderFrame({ dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: idle.dayPhase, cache: idle.cache, players: idle.players, localPlayerId: idle.localPlayerId });
    return;
  }
  ctx.velTracker.update(pre.entities, ctx.nowMs);
  const preLocal = pre.players.find((p) => p.id === pre.localPlayerId);
  ctx.input.setGearState({ heldItem: preLocal?.heldItem ?? null, hasShield: pre.inventory.armor.offhand === "wooden-shield" });
  ctx.input.setTorchLit(Boolean(preLocal?.torchLit));
  const move = ctx.input.movement();
  const combat = ctx.input.consumeCombat();
  const aim = resolveAimForTick({ ctx, combat, move, local: preLocal, entities: pre.entities });
  ctx.client.stepInput({
    move, dt: ctx.dt, aim, jump: ctx.input.consumeJump(), attack: combat.attack, attackHold: combat.attackHold,
    bowDraw: combat.bowDraw, bowRelease: combat.bowRelease, block: combat.block, dodge: combat.dodge,
    dodgeDir: combat.dodgeDir, crouch: combat.crouch, throwPebble: combat.throwPebble, interact: combat.interact,
  });
  const view = ctx.client.snapshot();
  const frameEvents = [...pre.events, ...view.events];
  const dists = ctx.scene.renderFrame({ dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: view.dayPhase, cache: view.cache, players: view.players, localPlayerId: view.localPlayerId, projectiles: view.projectiles, entities: view.entities, chests: view.chests, groundLoot: view.groundLoot, webs: view.webs, events: frameEvents });
  syncUiAndAudio({ ctx, view, events: frameEvents, dt: ctx.dt, dists });
}

function startRenderLoop(ctx: AppCtx): void {
  let prevMs = performance.now();
  const loop = (nowMs: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) / 1000));
    prevMs = nowMs;
    renderTick({ ...ctx, nowMs, dt });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function buildHudActions(client: WorldClient, audio: AudioEngine, toggleTorch: () => void): HudActions {
  return {
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onMoveSlot: (move) => client.moveSlot(move),
    onEquipArmor: (req) => { client.equipArmor(req); audio.playUi("equip"); },
    onUnequipArmor: (req) => { client.unequipArmor(req); audio.playUi("equip"); },
    onChestTransfer: (req) => { if (req.chestId) { client.chestTransfer({ ...req, chestId: req.chestId }); audio.playUi("click"); } },
    onChestTakeAll: (chestId) => { client.chestTakeAll(chestId); audio.playUi("equip"); },
    onCraft: (recipeId) => { client.craftRecipe(recipeId); audio.playUi("craft"); },
    onSetCharacter: (req) => client.setCharacter(req),
    onToggleTorch: toggleTorch,
  };
}

function tryTapWorldInteract(opts: {
  readonly clientX: number; readonly clientY: number; readonly scene: WorldScene;
  readonly client: WorldClient; readonly hud: HudRoot; readonly audio: AudioEngine;
}): void {
  const snap = opts.client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const hit = resolveTapInteractTarget({ chests: snap.chests, groundLoot: snap.groundLoot, world: opts.scene.screenToWorldTile(opts.clientX, opts.clientY), me });
  if (!hit) return;
  if (hit.kind === "chest") {
    opts.client.openChest(hit.id); opts.hud.openChest(hit.id); opts.audio.playUi("open");
    return;
  }
  opts.client.pickupLoot(hit.id); opts.audio.playUi("equip");
}

function mountSettingsForUi(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient;
  readonly audio: AudioEngine; readonly toolbar: AtmosphereToolbar; readonly hud: HudRoot;
  readonly onReturnToTitle: () => void; readonly onCrouchMode?: (mode: "toggle" | "hold") => void;
}): SettingsMenu {
  const { host, scene, client, audio, toolbar, hud, onReturnToTitle, onCrouchMode } = opts;
  const settings = new SettingsMenu(host, {
    audio, isLocalDebug: isLocalDebugOrigin(), initialQuality: scene.qualityPreset(), initialZoom: scene.currentZoom(),
    onSetQuality: (q) => scene.setQualityPreset(q), onSetGoreLevel: (lvl) => scene.setGoreLevel(lvl),
    onZoom: (f) => { scene.adjustZoom(f); return scene.currentZoom(); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onRespawn: () => { client.respawn(); audio.playUi("open"); },
    onReturnToTitle: () => { hud.closePanels(); onReturnToTitle(); },
    onPrefsChange: (p) => { toolbar.setFpsVisible(p.showFps); scene.setShowHitboxes(p.showHitboxes && isLocalDebugOrigin()); onCrouchMode?.(p.crouchMode); },
  });
  toolbar.setFpsVisible(settings.currentPrefs().showFps);
  scene.setShowHitboxes(settings.currentPrefs().showHitboxes && isLocalDebugOrigin());
  onCrouchMode?.(settings.currentPrefs().crouchMode);
  return settings;
}

function createInputHooks(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient;
  readonly hud: HudRoot; readonly audio: AudioEngine;
  readonly onInteractWorld: (lootId?: string) => void; readonly onCloseAll: () => void;
}): InputController {
  const { host, scene, client, hud, audio, onInteractWorld, onCloseAll } = opts;
  return new InputController(host, {
    onToggleTorch: () => { client.toggleTorch(); audio.playUi("click"); },
    onZoom: (f) => scene.adjustZoom(f),
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onToggleInventory: () => { hud.toggleInventory(); audio.playUi("open"); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onToggleMap: () => { hud.toggleMap(); audio.playUi("open"); },
    onInteract: () => onInteractWorld(),
    onWorldTap: (cx, cy) => tryTapWorldInteract({ clientX: cx, clientY: cy, scene, client, hud, audio }),
    onClosePanels: onCloseAll,
  });
}

function handleWorldInteract(opts: { readonly client: WorldClient; readonly hud: HudRoot; readonly audio: AudioEngine; readonly lootId?: string | undefined }): void {
  const { client, hud, audio, lootId } = opts;
  if (hud.activePanel() === "chest") { hud.closePanels(); return; }
  if (lootId) { client.pickupLoot(lootId); audio.playUi("equip"); return; }
  const near = client.nearestChest();
  if (near) {
    client.openChest(near.id); hud.openChest(near.id); audio.playUi("open");
    return;
  }
  const snap = client.snapshot();
  const me = snap.players.find((p) => p.id === snap.localPlayerId);
  const arrow = me ? findManualLootInReach(snap.groundLoot, me) : undefined;
  if (arrow) { client.pickupLoot(arrow.id); audio.playUi("equip"); }
}

function mountUiControllers(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient;
  readonly audio: AudioEngine; readonly onReturnToTitle: () => void;
}) {
  const { host, scene, client, audio, onReturnToTitle } = opts;
  const hud = new HudRoot(host, buildHudActions(client, audio, () => { client.toggleTorch(); audio.playUi("click"); }));
  const feedback = new CombatFeedbackOverlay(host);
  const onInteractWorld = (lootId?: string) => handleWorldInteract({ client, hud, audio, lootId });
  const settingsRef: { current: SettingsMenu | null } = { current: null };
  let inputRef: InputController | null = null;
  const toolbar = new AtmosphereToolbar(host, {
    onSetDayPhase: (p, paused) => client.setDayPhase(p, paused), onSetQuality: (q) => scene.setQualityPreset(q),
    onToggleInventory: () => { settingsRef.current?.setOpen(false); hud.toggleInventory(); audio.playUi("open"); },
    onToggleSettings: () => { hud.closePanels(); settingsRef.current?.toggle(); audio.playUi("click"); },
    onDebugSpawn: (kind, count) => { client.debugSpawn(kind, count); audio.playUi("open"); },
  });
  const settings = mountSettingsForUi({ host, scene, client, audio, toolbar, hud, onReturnToTitle, onCrouchMode: (m) => inputRef?.setCrouchMode(m) });
  settingsRef.current = settings;
  const input = createInputHooks({ host, scene, client, hud, audio, onInteractWorld, onCloseAll: () => { hud.closePanels(); settings.setOpen(false); } });
  inputRef = input;
  input.setCrouchMode(settings.currentPrefs().crouchMode);
  return { hud, feedback, input, toolbar, settings, onInteractWorld };
}

async function bootOverworldClient(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) throw new Error("Missing #app mount node");
  installMobileAutoFullscreen();
  await preloadSpriteManifest();
  const params = new URLSearchParams(window.location.search);
  if (params.get("sandbox") === "1" && isLocalhostOrigin()) { await bootAssetSandbox(host); return; }
  const skipTitle = params.get("skipTitle") === "1";
  const scene = await WorldScene.mount(host);
  const client = new WorldClient(undefined, { autoConnect: skipTitle });
  installAdminConsole(client, { silent: !isLocalDebugOrigin() });
  const audio = new AudioEngine();
  const velTracker = new EntityVelocityTracker();
  const titleRef: { current: TitleScreen | null } = { current: null };
  const onReturnToTitle = () => { client.disconnect(); ui.input.setEnabled(false); titleRef.current?.reopen(client.snapshot().localName, client.snapshot().localAppearance); };
  const ui = mountUiControllers({ host, scene, client, audio, onReturnToTitle });
  const titleScreen = new TitleScreen(host, {
    initialName: client.snapshot().localName, initialAppearance: client.snapshot().localAppearance,
    onPreviewChange: (req) => client.setCharacter(req),
    onEnterWorld: (req) => {
      client.setCharacter(req); audio.playUi("open");
      client.connect(); ui.input.setEnabled(true); titleScreen.dismiss();
    },
  });
  titleRef.current = titleScreen;
  if (skipTitle) titleScreen.dismiss();
  else ui.input.setEnabled(false);
  scene.setInteractHandler((lootId) => ui.onInteractWorld(lootId));
  startRenderLoop({ scene, client, audio, velTracker, titleScreen, ...ui });
}

void bootOverworldClient();