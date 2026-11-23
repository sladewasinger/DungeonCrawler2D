/** Localhost Visual Asset & Terrain Diorama Sandbox orchestrator (/?sandbox=1). */
import { DEFAULT_APPEARANCE, TILE_PX, clamp, sampleDayNight } from "@dc2d/engine";
import { Application, Container } from "pixi.js";
import { AudioEngine } from "../audio/audioEngine.js";
import { InputController } from "../input/controller.js";
import { CombatVfxLayer } from "../render/combat/combatVfx.js";
import { EntityRenderer } from "../render/combat/entitySprites.js";
import { GoreSystem } from "../render/combat/goreSystem.js";
import { WorldPickupsRenderer } from "../render/combat/worldPickups.js";
import { CastShadowLayer } from "../render/shaders/castShadows.js";
import { FoliageWindEffect } from "../render/shaders/foliageWindFilter.js";
import { LightingSystem } from "../render/shaders/lightingSystem.js";
import { reportShaderDiagnostics } from "../render/shaders/shaderDiag.js";
import { getTilemapGlProgram } from "../render/shaders/tilemapMesh.js";
import { WaterSurfaceEffect } from "../render/shaders/waterFilter.js";
import { createPropTextureSet } from "../render/textures/propTextures.js";
import { getLoadedSpriteIds } from "../render/textures/spriteManifest.js";
import { playerVisualElevation } from "../render/world/cliffStrips.js";
import { PlayerView } from "../render/world/playerSprite.js";
import { buildGoreSpawn, resolveEventElev } from "../render/world/sceneHelpers.js";
import { FpsCounter } from "../ui/fpsCounter.js";
import { HudRoot } from "../ui/hud/hudRoot.js";
import type { HudActions } from "../ui/hud/slotRenderer.js";
import { CompassBadge } from "../ui/map/compassBadge.js";
import { ensureToolbarStyles } from "../ui/toolbarStyles.js";
import { PoseTunerPanel } from "./poseTuner/poseTunerPanel.js";
import { buildSandboxGallery, type SandboxGallery } from "./sandboxGallery.js";
import { SandboxSim } from "./sandboxSim.js";
import { mountSandboxTerrainDiorama, type SandboxDioramaView } from "./sandboxTerrain.js";
import { SandboxToolbar } from "./sandboxToolbar.js";

type SandboxRig = Awaited<ReturnType<typeof initPixiSandboxRig>>;

interface SandboxState {
  readonly rig: SandboxRig; readonly sim: SandboxSim; readonly gallery: SandboxGallery;
  readonly diorama: SandboxDioramaView; readonly entities: EntityRenderer; readonly pickups: WorldPickupsRenderer;
  readonly gore: GoreSystem; readonly vfx: CombatVfxLayer; readonly hud: HudRoot;
  readonly input: InputController; readonly compass: CompassBadge; readonly fps: FpsCounter;
  readonly toolbar: SandboxToolbar; readonly poseTuner: PoseTunerPanel;
  playerView: PlayerView | null; zoom: number; dayPhase: number; camX: number; camY: number;
}

function buildSandboxHudActions(sim: SandboxSim, audio: AudioEngine): HudActions {
  return {
    onSelectHotbar: (slot) => { sim.selectHotbar(slot); audio.playUi("click"); },
    onMoveSlot: (m) => sim.moveSlot(m),
    onEquipArmor: (r) => { sim.equipArmor(r); audio.playUi("equip"); },
    onUnequipArmor: (r) => { sim.unequipArmor(r); audio.playUi("equip"); },
    onChestTransfer: (r) => { if (r.chestId) { sim.chestTransfer({ ...r, chestId: r.chestId }); audio.playUi("click"); } },
    onChestTakeAll: (id) => { sim.chestTakeAll(id); audio.playUi("equip"); },
    onCraft: () => {},
    onSetCharacter: () => {},
    onToggleTorch: () => { sim.toggleTorch(); audio.playUi("click"); },
  };
}

function mountRightBadges(host: HTMLElement): { readonly compass: CompassBadge; readonly fps: FpsCounter } {
  ensureToolbarStyles();
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { position: "fixed", right: "12px", top: "54px", zIndex: "44", display: "flex", gap: "6px" });
  const fps = new FpsCounter();
  const compass = new CompassBadge();
  wrap.append(fps.el, compass.el);
  host.append(wrap);
  return { compass, fps };
}

function normalizeAim(dx: number, dy: number): { readonly x: number; readonly y: number } {
  const m = Math.hypot(dx, dy);
  return m > 0.05 ? { x: dx / m, y: dy / m } : { x: 0, y: -1 };
}

function computeAimTarget(st: SandboxState, nowMs: number): { readonly x: number; readonly y: number } {
  const mouse = st.input.mouseAim(nowMs);
  if (!mouse) return { x: 0, y: -1 };
  const rect = st.rig.app.canvas.getBoundingClientRect();
  const sw = st.rig.app.screen.width;
  const sh = st.rig.app.screen.height;
  const sx = ((mouse.x - rect.left) * sw) / Math.max(1, rect.width);
  const sy = ((mouse.y - rect.top) * sh) / Math.max(1, rect.height);
  const tx = ((sx - sw * 0.5) / st.zoom + st.camX * TILE_PX) / TILE_PX;
  const ty = ((sy - sh * 0.5) / st.zoom + st.camY * TILE_PX) / TILE_PX;
  const me = st.sim.localPose();
  return normalizeAim(tx - me.x, ty - (me.y - me.elevation * 0.625 - 0.6));
}

function renderSandboxAtmosphere(st: SandboxState, opts: { readonly timeSec: number; readonly pl: ReturnType<SandboxSim["step"]>["player"] }): void {
  const { rig } = st;
  const { timeSec, pl } = opts;
  const dayNight = sampleDayNight(st.dayPhase);
  const sw = rig.app.screen.width; const sh = rig.app.screen.height;
  const wx = st.camX * TILE_PX - (sw * 0.5) / st.zoom;
  const wy = st.camY * TILE_PX - (sh * 0.5) / st.zoom;
  rig.waterEffect.update({ timeSec, enabled: true, worldOriginX: wx, worldOriginY: wy, zoom: st.zoom, dayNight });
  rig.grassWind.update({ timeSec, windStrength: 1.4, worldOriginX: wx, worldOriginY: wy, zoom: st.zoom });
  rig.canopyWind.update({ timeSec, windStrength: 0.9, worldOriginX: wx, worldOriginY: wy, zoom: st.zoom });
  rig.castShadows.update([...st.diorama.casters, { x: pl.x, y: pl.y - pl.elevation * 0.625, widthPx: 10, lengthPx: 16 }], dayNight);
  const lights = [...st.gallery.lights, ...st.diorama.lights];
  if (pl.torchLit) lights.push({ id: "sbx-pl-torch", kind: "torch", x: pl.x, y: pl.y - 0.35 - pl.elevation * 0.625, color: 0xffb84d, radiusPx: 140, intensity: 1.1 });
  rig.lighting.renderPass({
    renderer: rig.app.renderer, width: sw, height: sh, lightmapScale: 0.5, timeSec, dayNight,
    camera: { x: st.camX, y: st.camY, zoom: st.zoom }, lights, godRaysEnabled: true,
  });
}

function resolveSandboxAim(opts: {
  readonly st: SandboxState; readonly nowMs: number;
  readonly move: { readonly x: number; readonly y: number };
  readonly combat: { readonly attack: boolean; readonly bowDraw: boolean; readonly bowRelease: boolean };
}): { readonly x: number; readonly y: number } | undefined {
  const { st, nowMs, move, combat } = opts;
  if (Math.hypot(move.x, move.y) <= 0.05 || combat.attack || combat.bowDraw || combat.bowRelease) {
    return computeAimTarget(st, nowMs);
  }
  return st.sim.isInCombatAim() || st.poseTuner.isOpen() ? computeAimTarget(st, nowMs) : undefined;
}

function applySandboxGoreAndVfx(st: SandboxState, cur: ReturnType<SandboxSim["step"]>, ctx: { readonly pl: ReturnType<SandboxSim["step"]>["player"]; readonly dt: number }): void {
  st.vfx.handleEvents(cur.events, ctx.pl.id, [ctx.pl]);
  st.gore.setTileSampler(st.sim.cache);
  for (const ev of cur.events) if (ev.kind === "hit" && ev.goreStyle && ev.substance) st.gore.spawn(buildGoreSpawn(ev, resolveEventElev(ev.targetId, cur.entities, ctx.pl), st.sim.cache));
  st.gore.stepBleedDrips([ctx.pl], cur.entities, ctx.dt);
  st.gore.stepFootprints([ctx.pl], cur.entities);
  st.gore.step(ctx.dt);
  st.vfx.step({ dt: ctx.dt, projectiles: cur.projectiles, players: [ctx.pl], local: ctx.pl });
}

function stepSandboxFrame(st: SandboxState, nowMs: number, dt: number): void {
  st.fps.tick(nowMs);
  const move = st.input.movement();
  const combat = st.input.consumeCombat();
  const cur = st.sim.step({
    dt, timeSec: nowMs / 1000, move, aim: resolveSandboxAim({ st, nowMs, move, combat }),
    attack: combat.attack, block: combat.block, dodge: combat.dodge,
    jump: st.input.consumeJump(), bowDraw: combat.bowDraw, bowRelease: combat.bowRelease,
  });
  const pl = st.poseTuner.applyPreview(cur.player);
  st.input.setGearState({ isBowHeld: pl.heldItem === "bow", hasShield: cur.inventory.armor.offhand === "wooden-shield" });
  st.camX += (pl.x - st.camX) * Math.min(1, dt * 8);
  st.camY += (pl.y - pl.elevation * 0.625 - 2.2 - st.camY) * Math.min(1, dt * 8);
  const sw = st.rig.app.screen.width; const sh = st.rig.app.screen.height;
  for (const h of st.rig.filterHosts) h.filterArea = st.rig.app.screen;
  for (const cam of st.rig.cams) {
    cam.position.set(sw * 0.5, sh * 0.5); cam.pivot.set(st.camX * TILE_PX, st.camY * TILE_PX); cam.scale.set(st.zoom);
  }
  const timeSec = nowMs / 1000;
  st.playerView ??= (() => { const pv = new PlayerView(st.gallery.propsAtlas.torchFrames[0]!, pl); st.rig.ysortCam.addChild(pv.root); return pv; })();
  const { visualElev, sortBoost } = playerVisualElevation({ cache: st.sim.cache, x: pl.x, y: pl.y, baseElev: pl.elevation });
  st.playerView.sync({ snap: pl, torchFrames: st.gallery.propsAtlas.torchFrames, timeSec, visualElev, sortBoost });
  st.entities.sync(st.rig.ysortCam, cur.entities, timeSec);
  st.pickups.sync({ chests: cur.chests, groundLoot: [], local: pl, timeSec });
  st.gallery.animate(timeSec);
  st.diorama.animate([pl], timeSec);
  applySandboxGoreAndVfx(st, cur, { pl, dt });
  renderSandboxAtmosphere(st, { timeSec, pl });
  st.hud.sync({ inventory: cur.inventory, name: pl.name, appearance: pl.appearance ?? DEFAULT_APPEARANCE, localPlayer: pl, cache: st.sim.cache, players: [pl], entities: cur.entities, chests: cur.chests });
  st.compass.sync(pl.x, pl.y);
  st.toolbar.sync({ aiLive: st.sim.isAiLive(), pose: st.sim.getPose(), facing: st.sim.getFacing(), dayPhase: st.dayPhase, poseTunerOpen: st.poseTuner.isOpen() });
  st.rig.app.render();
}

async function initPixiSandboxRig(host: HTMLElement) {
  const app = new Application();
  await app.init({
    resizeTo: host, preference: "webgl", antialias: false, roundPixels: true, autoStart: false,
    backgroundColor: 0x0d131a, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true,
  });
  host.appendChild(app.canvas);
  const sceneRoot = new Container();
  const [groundCam, waterCam, shadowCam, decalCam, grassCam, ysortCam, canopyCam, emissiveCam] = Array.from({ length: 8 }, () => new Container());
  ysortCam!.sortableChildren = true;
  const [waterHost, grassHost, canopyHost] = [new Container(), new Container(), new Container()];
  const [waterEffect, grassWind, canopyWind, castShadows, lighting] = [
    new WaterSurfaceEffect(), new FoliageWindEffect(), new FoliageWindEffect(), new CastShadowLayer(), new LightingSystem(app.screen.width, app.screen.height),
  ];
  waterHost.addChild(waterCam!); grassHost.addChild(grassCam!); canopyHost.addChild(canopyCam!);
  shadowCam!.addChild(castShadows.container);
  waterHost.filters = [waterEffect.filter]; grassHost.filters = [grassWind.filter]; canopyHost.filters = [canopyWind.filter];
  sceneRoot.filters = [lighting.filter];
  sceneRoot.addChild(groundCam!, waterHost, shadowCam!, decalCam!, grassHost, ysortCam!, canopyHost);
  app.stage.addChild(sceneRoot, emissiveCam!);
  return {
    app, sceneRoot, filterHosts: [sceneRoot, waterHost, grassHost, canopyHost],
    cams: [groundCam!, waterCam!, shadowCam!, decalCam!, grassCam!, ysortCam!, canopyCam!, emissiveCam!],
    groundCam: groundCam!, waterCam: waterCam!, decalCam: decalCam!, grassCam: grassCam!, ysortCam: ysortCam!, canopyCam: canopyCam!, emissiveCam: emissiveCam!,
    lighting, waterEffect, grassWind, canopyWind, castShadows,
  };
}

function mountSandboxHud(host: HTMLElement, sim: SandboxSim, audio: AudioEngine) {
  const hud = new HudRoot(host, buildSandboxHudActions(sim, audio));
  const onInteract = (): void => {
    if (hud.activePanel() === "chest") { hud.closePanels(); return; }
    const near = sim.nearestChest();
    if (!near) return;
    sim.openChest(near.id);
    hud.openChest(near.id);
    audio.playUi("open");
  };
  return { hud, onInteract, pickups: new WorldPickupsRenderer(host, onInteract) };
}

function createSandboxControls(opts: {
  readonly host: HTMLElement; readonly sim: SandboxSim; readonly hud: HudRoot;
  readonly poseTuner: PoseTunerPanel; readonly getState: () => SandboxState; readonly onInteract: () => void;
}) {
  const { host, sim, hud, poseTuner, getState, onInteract } = opts;
  const jumpTo = (x: number, y: number): void => {
    sim.teleportTo(x, y); const st = getState();
    st.camX = x; st.camY = y - 2.2;
  };
  const setZoom = (f: number): void => { const st = getState(); st.zoom = clamp(st.zoom * f, 1.3, 5.0); };
  const input = new InputController(host, {
    onToggleTorch: () => sim.toggleTorch(), onZoom: setZoom,
    onSelectHotbar: (s) => sim.selectHotbar(s), onToggleInventory: () => hud.toggleInventory(),
    onToggleCrafting: () => hud.toggleCrafting(), onToggleCharacter: () => hud.toggleCharacter(),
    onInteract, onClosePanels: () => hud.closePanels(),
  });
  const toolbar = new SandboxToolbar(host, {
    onToggleAi: () => sim.setAiLive(!sim.isAiLive()), onWakeNearest: () => sim.wakeNearest(),
    onSpawnPack: () => sim.spawnWolfPack(), onSetPose: (pose) => sim.setPose(pose),
    onSetFacing: (facing) => sim.setFacing(facing), onSetDayPhase: (phase) => { getState().dayPhase = phase; },
    onZoom: setZoom, onJumpGallery: () => jumpTo(21, 26.2), onJumpTerrain: () => jumpTo(68, 16.5),
    onTogglePoseTuner: () => poseTuner.toggle(), onReset: () => { sim.resetArena(); getState().gore.clear(); hud.closePanels(); jumpTo(21, 26.2); },
  }, getLoadedSpriteIds().length);
  return { input, toolbar };
}

function createSandboxState(host: HTMLElement, rig: SandboxRig): SandboxState {
  const sim = new SandboxSim(); const gore = new GoreSystem(); const vfx = new CombatVfxLayer();
  gore.attachElevatedLayer(rig.ysortCam); rig.decalCam.addChild(gore.decalLayer);
  rig.ysortCam.addChild(gore.particleLayer); rig.emissiveCam.addChild(vfx.container);
  const propsAtlas = createPropTextureSet();
  const diorama = mountSandboxTerrainDiorama({ layers: { ground: rig.groundCam, water: rig.waterCam, grass: rig.grassCam, ysort: rig.ysortCam, canopy: rig.canopyCam }, cache: sim.cache, propsAtlas });
  const gallery = buildSandboxGallery({ ground: rig.groundCam, ysort: rig.ysortCam, canopy: rig.canopyCam, propsAtlas });
  const { hud, onInteract, pickups } = mountSandboxHud(host, sim, new AudioEngine());
  rig.ysortCam.addChild(pickups.container);
  const { compass, fps } = mountRightBadges(host);
  const ref: { st?: SandboxState } = {};
  const poseTuner = new PoseTunerPanel(host, { onZoomClose: () => { if (ref.st) ref.st.zoom = 4.2; } });
  const { input, toolbar } = createSandboxControls({ host, sim, hud, poseTuner, getState: () => ref.st!, onInteract });
  ref.st = { rig, sim, gallery, diorama, entities: new EntityRenderer(), pickups, gore, vfx, hud, compass, fps, input, toolbar, poseTuner, playerView: null, zoom: 2.6, dayPhase: 0.42, camX: 21, camY: 23.6 };
  return ref.st;
}

export async function bootAssetSandbox(host: HTMLElement): Promise<void> {
  const rig = await initPixiSandboxRig(host);
  reportShaderDiagnostics(rig.app.renderer, [{ name: "tilemap", glProgram: getTilemapGlProgram() }]);
  const st = createSandboxState(host, rig);
  let prevMs = performance.now();
  const loop = (nowMs: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) / 1000));
    prevMs = nowMs; stepSandboxFrame(st, nowMs, dt); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
