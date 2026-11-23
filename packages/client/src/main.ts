/** Client boot entry: mounts PixiJS v8 shader scene, Web Audio engine, networking, input, and HUD. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { AudioEngine } from "./audio/audioEngine.js";
import { InputController, type CombatInputsFrame } from "./input/controller.js";
import { WorldClient, type WorldViewState } from "./net/worldClient.js";
import { preloadSpriteManifest } from "./render/textures/spriteManifest.js";
import { WorldScene } from "./render/world/worldScene.js";
import { bootAssetSandbox } from "./sandbox/sandboxMode.js";
import { AtmosphereToolbar } from "./ui/atmosphereToolbar.js";
import { AudioPopover } from "./ui/audioPopover.js";
import { installMobileAutoFullscreen } from "./ui/fullscreen.js";
import { HudRoot } from "./ui/hud/hudRoot.js";
import type { HudActions } from "./ui/hud/slotRenderer.js";
import { CombatFeedbackOverlay } from "./ui/overlays/combatFeedbackOverlay.js";
import { isLocalhostOrigin, TitleScreen } from "./ui/title/titleScreen.js";

interface AppCtx {
  readonly scene: WorldScene;
  readonly client: WorldClient;
  readonly input: InputController;
  readonly toolbar: AtmosphereToolbar;
  readonly hud: HudRoot;
  readonly feedback: CombatFeedbackOverlay;
  readonly audio: AudioEngine;
  readonly audioPopover: AudioPopover;
  readonly titleScreen: TitleScreen | null;
}

function resolveAimVector(ctx: AppCtx & { readonly nowMs: number }): { readonly x: number; readonly y: number } | undefined {
  const mouse = ctx.input.mouseAim(ctx.nowMs);
  if (!mouse) return undefined;
  const me = ctx.client.localPose();
  const target = ctx.scene.screenToWorldTile(mouse.x, mouse.y);
  const dx = target.x - me.x;
  const dy = target.y - (me.y - me.elevation * 0.625 - 0.6);
  const mag = Math.hypot(dx, dy);
  return mag > 0.05 ? { x: dx / mag, y: dy / mag } : undefined;
}

function hasCombatAim(combat: CombatInputsFrame, local: PlayerSnapshot | undefined): boolean {
  if (combat.attack || combat.bowDraw || combat.bowRelease) return true;
  if (!local) return false;
  return (local.swingProgress ?? 0) > 0 || (local.bowCharge ?? 0) > 0.05;
}

function scoreSoftLockTarget(opts: {
  readonly e: WorldEntitySnapshot; readonly local: PlayerSnapshot; readonly aim: { readonly x: number; readonly y: number };
}): { readonly tx: number; readonly ty: number; readonly score: number } | undefined {
  if (opts.e.hp <= 0) return undefined;
  const dx = opts.e.x - opts.local.x;
  const dy = opts.e.y - opts.local.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0.4 || d > 10) return undefined;
  const tx = dx / d;
  const ty = dy / d;
  const dot = tx * opts.aim.x + ty * opts.aim.y;
  return dot >= 0.86 ? { tx, ty, score: dot } : undefined;
}

function findBestSoftLock(
  aim: { readonly x: number; readonly y: number },
  local: PlayerSnapshot,
  entities: readonly WorldEntitySnapshot[],
): { readonly tx: number; readonly ty: number; readonly score: number } | undefined {
  let best: { readonly tx: number; readonly ty: number; readonly score: number } | undefined;
  for (const e of entities) {
    const cand = scoreSoftLockTarget({ e, local, aim });
    if (cand && (!best || cand.score > best.score)) best = cand;
  }
  return best;
}

function assistMobileAim(
  aim: { readonly x: number; readonly y: number } | undefined,
  local: PlayerSnapshot | undefined,
  entities: readonly WorldEntitySnapshot[],
): { readonly x: number; readonly y: number } | undefined {
  if (!aim || !local || entities.length === 0) return aim;
  const best = findBestSoftLock(aim, local, entities);
  if (!best) return aim;
  const bx = aim.x * 0.35 + best.tx * 0.65;
  const by = aim.y * 0.35 + best.ty * 0.65;
  const mag = Math.hypot(bx, by);
  return mag > 0.01 ? { x: bx / mag, y: by / mag } : aim;
}

function syncUiAndAudio(opts: {
  readonly ctx: AppCtx;
  readonly view: ReturnType<WorldClient["snapshot"]>;
  readonly preEvents: WorldViewState["events"];
  readonly dt: number;
  readonly dists: { readonly campfireDist: number; readonly waterDist: number };
}): void {
  const { ctx, view, dists } = opts;
  const local = view.players.find((p) => p.id === view.localPlayerId);
  const pos = local ? { x: local.x, y: local.y } : { x: 0.5, y: 0.5 };
  ctx.audio.handleWorldEvents([...opts.preEvents, ...view.events], pos);
  ctx.audio.stepFrame({
    local, cache: view.cache, dt: opts.dt, dayPhase: view.dayPhase,
    campfireDist: dists.campfireDist, waterDist: dists.waterDist,
  });
  ctx.hud.sync({
    inventory: view.inventory, name: view.localName, appearance: view.localAppearance,
    localPlayer: local, cache: view.cache, players: view.players, entities: view.entities, chests: view.chests,
  });
  ctx.feedback.sync({
    local,
    events: [...opts.preEvents, ...view.events],
    localId: view.localPlayerId,
    dt: opts.dt,
  });
  ctx.toolbar.sync({
    mode: view.mode, dayPhase: view.dayPhase, dayPaused: view.dayPaused,
    quality: ctx.scene.qualityPreset(), activePanel: ctx.hud.activePanel(),
    audioOpen: ctx.audioPopover.isOpen(), audioMuted: ctx.audioPopover.isMuted(),
    playerX: local?.x ?? 0, playerY: local?.y ?? 0,
  });
}

function renderTick(ctx: AppCtx & { readonly nowMs: number; readonly dt: number }): void {
  ctx.toolbar.tickFps(ctx.nowMs);
  const pre = ctx.client.snapshot();
  if (ctx.titleScreen?.isOpen()) {
    ctx.client.stepInput({ move: { x: 0, y: 0 }, dt: ctx.dt });
    const idleView = ctx.client.snapshot();
    ctx.scene.renderFrame({
      dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: idleView.dayPhase, cache: idleView.cache,
      players: idleView.players, localPlayerId: idleView.localPlayerId,
    });
    return;
  }
  const preLocal = pre.players.find((p) => p.id === pre.localPlayerId);
  ctx.input.setGearState({
    isBowHeld: preLocal?.heldItem === "bow",
    hasShield: pre.inventory.armor.offhand === "wooden-shield",
  });
  const move = ctx.input.movement();
  const combat = ctx.input.consumeCombat();
  const standingStill = Math.hypot(move.x, move.y) <= 0.05;
  const aim = assistMobileAim(combat.mobileAim, preLocal, pre.entities)
    ?? (standingStill || hasCombatAim(combat, preLocal) ? resolveAimVector(ctx) : undefined);
  ctx.client.stepInput({
    move, dt: ctx.dt, aim, jump: ctx.input.consumeJump(),
    attack: combat.attack, bowDraw: combat.bowDraw, bowRelease: combat.bowRelease,
    block: combat.block, dodge: combat.dodge, interact: combat.interact,
  });
  const view = ctx.client.snapshot();
  const dists = ctx.scene.renderFrame({
    dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: view.dayPhase, cache: view.cache,
    players: view.players, localPlayerId: view.localPlayerId,
    projectiles: view.projectiles, entities: view.entities, chests: view.chests, groundLoot: view.groundLoot, events: view.events,
  });
  syncUiAndAudio({ ctx, view, preEvents: pre.events, dt: ctx.dt, dists });
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

function mountHudAndControls(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient; readonly audio: AudioEngine;
}): {
  readonly hud: HudRoot; readonly feedback: CombatFeedbackOverlay; readonly input: InputController;
  readonly toolbar: AtmosphereToolbar; readonly audioPopover: AudioPopover; readonly onInteractChest: () => void;
} {
  const { host, scene, client, audio } = opts;
  const toggleTorch = () => { client.toggleTorch(); audio.playUi("click"); };
  const hud = new HudRoot(host, buildHudActions(client, audio, toggleTorch));
  const feedback = new CombatFeedbackOverlay(host);
  const onInteractChest = () => {
    if (hud.activePanel() === "chest") { hud.closePanels(); return; }
    const near = client.nearestChest();
    if (!near) return;
    client.openChest(near.id);
    hud.openChest(near.id);
    audio.playUi("open");
  };
  const input = new InputController(host, {
    onToggleTorch: toggleTorch, onZoom: (factor) => scene.adjustZoom(factor),
    onSelectHotbar: (slot) => { client.selectHotbar(slot); audio.playUi("click"); },
    onToggleInventory: () => { hud.toggleInventory(); audio.playUi("open"); },
    onToggleCrafting: () => { hud.toggleCrafting(); audio.playUi("open"); },
    onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onInteract: onInteractChest, onClosePanels: () => hud.closePanels(),
  });
  const audioPopover = new AudioPopover(host, audio);
  const toolbar = new AtmosphereToolbar(host, {
    onSetDayPhase: (phase, paused) => client.setDayPhase(phase, paused), onSetQuality: (preset) => scene.setQualityPreset(preset),
    onToggleInventory: () => { hud.toggleInventory(); audio.playUi("open"); }, onToggleCharacter: () => { hud.toggleCharacter(); audio.playUi("open"); },
    onToggleAudio: () => { audioPopover.toggle(); audio.playUi("click"); }, onZoom: (factor) => scene.adjustZoom(factor),
    onDebugSpawn: (kind, count) => { client.debugSpawn(kind, count); audio.playUi("open"); },
  });
  return { hud, feedback, input, toolbar, audioPopover, onInteractChest };
}

async function bootOverworldClient(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) throw new Error("Missing #app mount node");
  installMobileAutoFullscreen();
  await preloadSpriteManifest();
  const params = new URLSearchParams(window.location.search);
  if (params.get("sandbox") === "1" && isLocalhostOrigin()) {
    await bootAssetSandbox(host);
    return;
  }
  const skipTitle = params.get("skipTitle") === "1";
  const scene = await WorldScene.mount(host);
  const client = new WorldClient(undefined, { autoConnect: skipTitle });
  const audio = new AudioEngine();
  const ui = mountHudAndControls({ host, scene, client, audio });
  scene.setInteractHandler(() => ui.onInteractChest());
  const snap = client.snapshot();
  let titleScreen: TitleScreen | null = null;
  if (!skipTitle) {
    ui.input.setEnabled(false);
    titleScreen = new TitleScreen(host, {
      initialName: snap.localName,
      initialAppearance: snap.localAppearance,
      onPreviewChange: (req) => client.setCharacter(req),
      onEnterWorld: (req) => {
        client.setCharacter(req);
        audio.playUi("open");
        client.connect();
        ui.input.setEnabled(true);
        titleScreen?.dismiss();
      },
    });
  }
  startRenderLoop({ scene, client, audio, titleScreen, ...ui });
}

void bootOverworldClient();
