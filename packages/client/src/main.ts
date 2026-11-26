/** Client boot entry: mounts PixiJS v8 shader scene, Web Audio engine, networking, input, and HUD. */
import { isBowItem, isShieldItem } from "@dc2d/content";
import { ELEVATION_LIFT_TILES, type PlayerSnapshot, type WorldEntitySnapshot } from "@dc2d/engine";
import { installAdminConsole } from "./admin/adminConsole.js";
import { AudioEngine } from "./audio/audioEngine.js";
import { EntityVelocityTracker, isTouchViewport, resolveMobileBowAutoAim, resolveMobileMeleeAutoAim } from "./input/autoAim.js";
import { InputController, type CombatInputsFrame } from "./input/controller.js";
import { buildClientHudActions, createClientInputHooks, handleWorldInteract, mountSettingsForUi } from "./input/worldInteractHooks.js";
import { saveCharacterPrefs } from "./net/characterPrefs.js";
import { WorldClient, type WorldViewState } from "./net/worldClient.js";
import { WorldScene } from "./render/world/worldScene.js";
import { AtmosphereToolbar } from "./ui/atmosphereToolbar.js";
import { installQaDiagBridge } from "./diag/qaDiagBridge.js";
import { ChatOverlay } from "./ui/chat/chatOverlay.js";
import { DiscoveryOverlay } from "./ui/discovery/discoveryOverlay.js";
import { installMobileAutoFullscreen } from "./ui/fullscreen.js";
import { HudRoot } from "./ui/hud/hudRoot.js";
import { runBootPreloadFlow } from "./ui/loading/bootPreloader.js";
import { formatCompassBiomeHint } from "./ui/map/mapPinRenderer.js";
import { CombatFeedbackOverlay } from "./ui/overlays/combatFeedbackOverlay.js";
import { ConnectionStatusOverlay } from "./ui/overlays/connectionOverlay.js";
import type { SettingsMenu } from "./ui/settings/settingsMenu.js";
import { isLocalDebugOrigin } from "./ui/settings/settingsPrefs.js";
import { isLocalhostOrigin, TitleScreen } from "./ui/title/titleScreen.js";

interface AppCtx {
  readonly scene: WorldScene; readonly client: WorldClient; readonly input: InputController; readonly toolbar: AtmosphereToolbar;
  readonly hud: HudRoot; readonly chat: ChatOverlay; readonly discovery: DiscoveryOverlay; readonly feedback: CombatFeedbackOverlay;
  readonly connOverlay: ConnectionStatusOverlay; readonly audio: AudioEngine; readonly settings: SettingsMenu;
  readonly velTracker: EntityVelocityTracker; readonly titleScreen: TitleScreen;
}

function resolveMouseAim(ctx: AppCtx & { readonly nowMs: number }): { readonly x: number; readonly y: number } | undefined {
  const mouse = ctx.input.mouseAim(ctx.nowMs);
  if (!mouse) return undefined;
  const me = ctx.client.localPose();
  const target = ctx.scene.screenToWorldTile(mouse.x, mouse.y);
  const dx = target.x - me.x;
  const dy = target.y - (me.y - me.elevation * ELEVATION_LIFT_TILES - 0.52);
  const mag = Math.hypot(dx, dy);
  return mag > 0.05 ? { x: dx / mag, y: dy / mag } : undefined;
}

const hasPlayerCombatPose = (local?: PlayerSnapshot): boolean =>
  Boolean(local && ((local.swingProgress ?? 0) > 0 || (local.heavyCharge ?? 0) > 0 || (local.bowCharge ?? 0) > 0.001));
const wantsCombatAim = (combat: CombatInputsFrame, local?: PlayerSnapshot): boolean =>
  combat.attack || combat.attackHold || combat.bowDraw || combat.bowRelease || hasPlayerCombatPose(local);

function resolveTouchMeleeSnap(opts: {
  readonly combat: CombatInputsFrame; readonly move: { readonly x: number; readonly y: number };
  readonly local?: PlayerSnapshot | undefined; readonly entities: readonly WorldEntitySnapshot[];
}): { readonly x: number; readonly y: number } | undefined {
  const { local, combat, move, entities } = opts;
  if (!local || !combat.attack || isBowItem(local.heldItem) || !isTouchViewport()) return undefined;
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
    if (!autoOn || !opts.local) return opts.combat.mobileAim;
    return resolveMobileBowAutoAim({ aim: opts.combat.mobileAim, local: opts.local, entities: opts.entities, tracker: opts.ctx.velTracker });
  }
  if (isTouchViewport()) return autoOn ? resolveTouchMeleeSnap(opts) : undefined;
  const stationary = Math.hypot(opts.move.x, opts.move.y) <= 0.05;
  return stationary || wantsCombatAim(opts.combat, opts.local) ? resolveMouseAim(opts.ctx) : undefined;
}

const mergeFrameChat = (pre: WorldViewState, view: WorldViewState) => [
  ...(pre.chatMessages ?? []),
  ...(view.chatMessages ?? []),
];

function syncUiAndAudio(opts: { readonly ctx: AppCtx; readonly view: WorldViewState; readonly events: WorldViewState["events"]; readonly chatMessages: NonNullable<WorldViewState["chatMessages"]>; readonly dt: number; readonly dists: { readonly campfireDist: number; readonly waterDist: number } }): void {
  const { ctx, view, events, dists } = opts;
  const local = view.players.find((p) => p.id === view.localPlayerId);
  const lx = local?.x ?? 0; const ly = local?.y ?? 0;
  ctx.audio.handleWorldEvents(events, { x: lx, y: ly });
  ctx.audio.stepFrame({ local, cache: view.cache, dt: opts.dt, dayPhase: view.dayPhase, ...dists });
  ctx.hud.sync({ inventory: view.inventory, name: view.localName, appearance: view.localAppearance, localPlayer: local, cache: view.cache, players: view.players, entities: view.entities, chests: view.chests, discovery: view.discovery });
  ctx.chat.pushMessages(opts.chatMessages, performance.now()); ctx.chat.pruneExpired(performance.now());
  ctx.discovery.sync({ x: lx, y: ly, worldSeed: view.cache.worldSeed, events, localPlayerId: view.localPlayerId, nowMs: performance.now(), onChime: () => ctx.audio.playUi("discover") });
  ctx.feedback.sync({ local, events, localId: view.localPlayerId, dt: opts.dt });
  ctx.toolbar.sync({ mode: view.mode, dayPhase: view.dayPhase, dayPaused: view.dayPaused, quality: ctx.scene.qualityPreset(), activePanel: ctx.hud.activePanel(), settingsOpen: ctx.settings.isOpen(), playerX: lx, playerY: ly, biomeHint: formatCompassBiomeHint(view.cache.worldSeed, lx, ly), pingMs: view.pingMs });
  ctx.settings.syncExternalState(ctx.scene.qualityPreset(), ctx.scene.currentZoom());
}

function renderTick(ctx: AppCtx & { readonly nowMs: number; readonly dt: number }): void {
  ctx.toolbar.tickFps(ctx.nowMs);
  const pre = ctx.client.snapshot();
  if (ctx.titleScreen.isOpen()) {
    ctx.connOverlay.sync({ visible: false, mode: pre.mode });
    ctx.client.stepInput({ move: { x: 0, y: 0 }, dt: ctx.dt });
    const idle = ctx.client.snapshot();
    ctx.scene.renderFrame({ dt: ctx.dt, timeSec: ctx.nowMs / 1000, dayPhase: idle.dayPhase, cache: idle.cache, players: idle.players, localPlayerId: idle.localPlayerId });
    return;
  }
  const connected = pre.mode === "server";
  ctx.connOverlay.sync({ visible: !connected, mode: pre.mode, attempt: pre.reconnectAttempt });
  ctx.input.setEnabled(connected);
  ctx.velTracker.update(pre.entities, ctx.nowMs);
  const preLocal = pre.players.find((p) => p.id === pre.localPlayerId);
  ctx.input.setGearState({ heldItem: preLocal?.heldItem ?? null, offhandItem: pre.inventory.armor.offhand, hasShield: isShieldItem(pre.inventory.armor.offhand) });
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
  syncUiAndAudio({ ctx, view, events: frameEvents, chatMessages: mergeFrameChat(pre, view), dt: ctx.dt, dists });
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

function mountUiControllers(opts: {
  readonly host: HTMLElement; readonly scene: WorldScene; readonly client: WorldClient;
  readonly audio: AudioEngine; readonly onReturnToTitle: () => void;
}) {
  const { host, scene, client, audio, onReturnToTitle } = opts;
  const hud = new HudRoot(host, buildClientHudActions(client, audio, () => { client.toggleTorch(); audio.playUi("click"); }));
  const chat = new ChatOverlay(host, (text, shout) => client.sendChat(text, shout));
  const discovery = new DiscoveryOverlay(host);
  const feedback = new CombatFeedbackOverlay(host);
  const connOverlay = new ConnectionStatusOverlay(host, {
    onReconnectNow: () => client.reconnectNow(),
    onReturnToTitle: () => { hud.closePanels(); onReturnToTitle(); },
  });
  let inputRef: InputController | null = null;
  const onInteractWorld = (lootId?: string) => {
    if (!handleWorldInteract({ client, hud, discovery, audio, lootId })) inputRef?.queueInteract();
  };
  const settingsRef: { current: SettingsMenu | null } = { current: null };
  const toolbar = new AtmosphereToolbar(host, {
    onSetDayPhase: (p, paused) => client.setDayPhase(p, paused), onSetQuality: (q) => scene.setQualityPreset(q),
    onToggleInventory: () => { settingsRef.current?.setOpen(false); hud.toggleInventory(); audio.playUi("open"); },
    onToggleSettings: () => { hud.closePanels(); settingsRef.current?.toggle(); audio.playUi("click"); },
    onDebugSpawn: (kind, count) => { client.debugSpawn(kind, count); audio.playUi("open"); },
  });
  const settings = mountSettingsForUi({ host, scene, client, audio, toolbar, hud, onReturnToTitle, onCrouchMode: (m) => inputRef?.setCrouchMode(m) });
  settingsRef.current = settings;
  const input = createClientInputHooks({ host, scene, client, hud, chat, discovery, audio, settings, onInteractWorld, onCloseAll: () => { chat.closeInput(); hud.closePanels(); settings.setOpen(false); } });
  inputRef = input; input.setCrouchMode(settings.currentPrefs().crouchMode);
  return { hud, chat, discovery, feedback, connOverlay, input, toolbar, settings, onInteractWorld };
}

async function mountOverworldApp(host: HTMLElement, skipTitle: boolean): Promise<AppCtx> {
  const scene = await WorldScene.mount(host);
  const client = new WorldClient(undefined, { autoConnect: skipTitle });
  installAdminConsole(client, { silent: !isLocalDebugOrigin() });
  const audio = new AudioEngine();
  const velTracker = new EntityVelocityTracker();
  const titleRef: { current: TitleScreen | null } = { current: null };
  const onReturnToTitle = () => { client.disconnect(); ui.input.setEnabled(false); titleRef.current?.reopen(client.snapshot().localName, client.snapshot().localAppearance); };
  const ui = mountUiControllers({ host, scene, client, audio, onReturnToTitle });
  const titleScreen = new TitleScreen(host, {
    initialName: client.snapshot().localName, initialAppearance: client.snapshot().localAppearance, onPreviewChange: saveCharacterPrefs,
    onEnterWorld: (req) => {
      client.setCharacter(req); audio.playUi("open");
      client.connect(); ui.input.setEnabled(true); titleScreen.dismiss();
    },
  });
  titleRef.current = titleScreen;
  if (skipTitle) titleScreen.dismiss(); else ui.input.setEnabled(false);
  scene.setInteractHandler((lootId) => ui.onInteractWorld(lootId));
  installQaDiagBridge({ scene, getPlayerPos: () => { const p = client.localPose(); return { x: p.x, y: p.y }; } });
  return { scene, client, audio, velTracker, titleScreen, ...ui };
}

async function bootOverworldClient(): Promise<void> {
  const host = document.getElementById("app");
  if (!host) throw new Error("Missing #app mount node");
  installMobileAutoFullscreen();
  const params = new URLSearchParams(window.location.search);
  let ctx: AppCtx | null = null;
  await runBootPreloadFlow({
    host,
    isSandbox: params.get("sandbox") === "1" && isLocalhostOrigin(),
    onSandbox: async () => { const { bootAssetSandbox } = await import("./sandbox/sandboxMode.js"); await bootAssetSandbox(host); },
    onMountWorld: async () => {
      ctx = await mountOverworldApp(host, params.get("skipTitle") === "1");
      return { appearance: ctx.client.snapshot().localAppearance, onBeforeReveal: () => renderTick({ ...ctx!, nowMs: performance.now(), dt: 0.016 }) };
    },
  });
  if (ctx) startRenderLoop(ctx);
}

void bootOverworldClient();