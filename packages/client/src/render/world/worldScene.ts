/** Top-level PixiJS v8 overworld scene coordinating shaders, camera, and quality scaling. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import {
  TILE_PX, WorldChunkCache, sampleDayNight, sampleMacroBiome,
  type GroundLootSnapshot, type PlayerSnapshot, type ProjectileSnapshot,
  type WorldChestSnapshot, type WorldEntitySnapshot, type WorldEvent, type WorldWebSnapshot,
} from "@dc2d/engine";
import { Application, Container } from "pixi.js";
import { BASE_CAMERA_ZOOM, sanitizeCameraZoom, stepCameraZoom } from "../../ui/settings/cameraZoom.js";
import { defaultQualityPreset } from "../../ui/settings/settingsPrefs.js";
import { CombatVfxLayer } from "../combat/combatVfx.js";
import { PLAYER_LEAVE_SMOKE_DURATION_SEC } from "../combat/combatVisualTuning.js";
import { HitboxDebugLayer } from "../combat/hitboxDebugLayer.js";
import type { GoreLevel } from "../combat/gore/gorePrefs.js";
import { GoreSystem } from "../combat/gore/goreSystem.js";
import { WebLayer } from "../combat/webs/webRenderer.js";
import { WorldPickupsRenderer } from "../combat/pickups/worldPickups.js";
import { HarvestFxLayer } from "../survival/harvestFxLayer.js";
import { PlacementGhostLayer, type PlacementGhostTarget } from "../survival/placementGhostLayer.js";
import { AmbientParticleLayer } from "../shaders/ambientParticles.js";
import { CastShadowLayer } from "../shaders/castShadows.js";
import { FoliageWindEffect } from "../shaders/foliageWindFilter.js";
import { LightingSystem } from "../shaders/lightingSystem.js";
import { WaterSurfaceEffect } from "../shaders/waterFilter.js";
import { createPropTextureSet } from "../textures/propTextures.js";
import { createTerrainTileAtlas } from "../textures/terrainTextures.js";
import { ChunkRenderer } from "./chunkRenderer.js";
import { HubNpcOverlay } from "./npcs/hubNpcOverlay.js";
import {
  buildSceneCameraRig, reportWorldSceneShaders, stepCameraFollow, syncWorldCameraContainers, updateWorldSceneShaders,
} from "./sceneCamera.js";
import {
  applyWorldEventsBatch, bindSceneContextAndViewport, buildSceneFxSinks, collectActorParticleEmitters,
  collectWaterActors, estimateManagedTextureStats, nearestCampfireDist, nearestWaterDist, type SceneAudioDistances,
} from "./sceneHelpers.js";

export type { SceneAudioDistances } from "./sceneHelpers.js";

export interface SceneFrameInput {
  readonly dt: number; readonly timeSec: number; readonly dayPhase: number; readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[]; readonly localPlayerId: string;
  readonly projectiles?: readonly ProjectileSnapshot[]; readonly entities?: readonly WorldEntitySnapshot[];
  readonly chests?: readonly WorldChestSnapshot[]; readonly groundLoot?: readonly GroundLootSnapshot[];
  readonly webs?: WorldWebSnapshot | undefined; readonly events?: readonly WorldEvent[];
  readonly cursorClient?: { readonly x: number; readonly y: number } | null | undefined;
  readonly ghostEnabled?: boolean | undefined;
}

 const CAMERA_TUNING = { defaultZoom: BASE_CAMERA_ZOOM, minZoom: 2.0, maxZoom: 8.0, followLerpRate: 9, hitstopTimeScale: 0.12, grassWindStrength: 0, canopyWindStrength: 0.9 } as const;

export class WorldScene {
  private readonly cameras: readonly Container[];
  private readonly filterHosts: readonly Container[];
  private readonly waterEffect = new WaterSurfaceEffect();
  private readonly grassWind = new FoliageWindEffect();
  private readonly canopyWind = new FoliageWindEffect();
  private readonly castShadows = new CastShadowLayer();
  private readonly particles = new AmbientParticleLayer();
  private readonly gore = new GoreSystem();
  private readonly webLayer = new WebLayer();
  private readonly pickups: WorldPickupsRenderer;
  private readonly vfx = new CombatVfxLayer();
  private readonly harvestFx = new HarvestFxLayer();
  private readonly hubNpcs = new HubNpcOverlay();
  private readonly placementGhost: PlacementGhostLayer;
  private readonly hitboxDebug = new HitboxDebugLayer();
  private readonly lighting: LightingSystem;
  private readonly chunks: ChunkRenderer;
  private readonly shaderErrors: readonly string[];
  private webglContextLost = false;
  private interactHandler: ((lootId?: string) => void) | null = null;
  private qualityId: QualityPresetId = defaultQualityPreset();
  private camX = 0.5;
  private camY = 0.5;
  private shakeMag = 0;
  private shakeTime = 0;
  private zoom: number = BASE_CAMERA_ZOOM;
  private canvasRect = { left: 0, top: 0, width: 1, height: 1 };
  private readonly unbindViewportSync: () => void;

  private constructor(private readonly app: Application, host: HTMLElement) {
    this.lighting = new LightingSystem(app.screen.width, app.screen.height);
    const rig = buildSceneCameraRig({
      app, waterFilter: this.waterEffect.filter, grassFilter: this.grassWind.filter,
      canopyFilter: this.canopyWind.filter, lightFilter: this.lighting.filter, grassWindStrength: CAMERA_TUNING.grassWindStrength,
    });
    this.cameras = rig.cameras; this.filterHosts = rig.filterHosts;
    rig.cameras[2]!.addChild(this.castShadows.container);
    rig.cameras[3]!.addChild(this.gore.decalLayer, this.webLayer.container);
    this.pickups = new WorldPickupsRenderer(host, (lootId) => this.interactHandler?.(lootId));
    this.placementGhost = new PlacementGhostLayer(host);
    this.configureGoreLayers(rig.layers.ysort);
    rig.emissiveCam.addChild(this.particles.container, this.vfx.container, this.harvestFx.container, this.hubNpcs.container, this.placementGhost.container, this.gore.sparkLayer, this.hitboxDebug.container);
    const props = createPropTextureSet();
    this.pickups.setHdWoodChests({ closed: props.woodChestClosed, open: props.woodChestOpen });
    this.chunks = new ChunkRenderer(rig.layers, { terrain: createTerrainTileAtlas(), props });
    this.harvestFx.setPropLookup((id) => this.chunks.findMountedProp(id));
    this.shaderErrors = reportWorldSceneShaders({ renderer: app.renderer, water: this.waterEffect.filter, wind: this.canopyWind.filter, lighting: this.lighting.filter });
    this.unbindViewportSync = bindSceneContextAndViewport({
      canvas: app.canvas, onContextLoss: (lost) => { this.webglContextLost = lost; },
      onRectSync: () => { const r = this.app.canvas.getBoundingClientRect(); this.canvasRect = { left: r.left, top: r.top, width: r.width, height: r.height }; },
    });
  }

  private configureGoreLayers(ysortCam: Container): void {
    this.gore.attachElevatedLayer(ysortCam);
    this.gore.particleLayer.zIndex = 100_000;
    ysortCam.addChild(this.pickups.container, this.gore.particleLayer);
    const preset = QUALITY_PRESETS[this.qualityId];
    this.gore.setQualityBudget({ maxDecals: preset.maxGoreDecals, maxGoreParticles: preset.maxGoreParticles });
  }

  static async mount(host: HTMLElement): Promise<WorldScene> {
    const app = new Application();
    const initPreset = QUALITY_PRESETS[defaultQualityPreset()];
    await app.init({
      resizeTo: host, preference: "webgl", antialias: false, roundPixels: true, autoStart: false,
      backgroundColor: 0x0d131a, resolution: Math.min(initPreset.maxDpr, window.devicePixelRatio || 1), autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new WorldScene(app, host);
  }

  cyclePlacementRotation(): number { return this.placementGhost.cycleRotation(); }
  currentPlacementTarget(): PlacementGhostTarget | null { return this.placementGhost.currentTarget(); }
  setInteractHandler(cb: (lootId?: string) => void): void { this.interactHandler = cb; }
  setGoreLevel(level: GoreLevel): void { this.gore.setGoreLevel(level); }
  setShowHitboxes(enabled: boolean): void { this.hitboxDebug.setEnabled(enabled); }
  setQualityPreset(presetId: QualityPresetId): void {
    this.qualityId = presetId;
    const preset = QUALITY_PRESETS[presetId];
    this.app.renderer.resolution = Math.min(preset.maxDpr, window.devicePixelRatio || 1);
    this.app.resize();
    this.gore.setQualityBudget({ maxDecals: preset.maxGoreDecals, maxGoreParticles: preset.maxGoreParticles });
  }
  qualityPreset(): QualityPresetId { return this.qualityId; }
  currentZoom(): number { return this.zoom; }
  getDiagnosticState() {
    const tex = estimateManagedTextureStats("managedTextures" in this.app.renderer.texture ? this.app.renderer.texture : {});
    return { canvasWidth: this.app.screen.width, canvasHeight: this.app.screen.height, chunkCount: this.chunks.mountedCount(), shaderErrors: this.shaderErrors, webglContextLost: this.webglContextLost, ...tex };
  }
  setZoom(zoom: number): void { this.zoom = sanitizeCameraZoom(zoom); }
  adjustZoom(factor: number): void { this.zoom = stepCameraZoom(this.zoom, factor); }

  screenToWorldTile(clientX: number, clientY: number): { readonly x: number; readonly y: number } {
    const rect = this.canvasRect;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const sx = ((clientX - rect.left) * sw) / Math.max(1, rect.width);
    const sy = ((clientY - rect.top) * sh) / Math.max(1, rect.height);
    return { x: ((sx - sw * 0.5) / this.zoom + this.camX * TILE_PX) / TILE_PX, y: ((sy - sh * 0.5) / this.zoom + this.camY * TILE_PX) / TILE_PX };
  }

  dispose(): void { this.unbindViewportSync(); }

  renderFrame(input: SceneFrameInput): SceneAudioDistances {
    const preset = QUALITY_PRESETS[this.qualityId];
    const local = input.players.find((p) => p.id === input.localPlayerId) ?? input.players[0];
    this.syncEvents(input, local);
    const simDt = this.vfx.consumeHitstop(input.dt) ? input.dt * CAMERA_TUNING.hitstopTimeScale : input.dt;
    this.followTarget(local, input.dt);
    this.syncCameraContainers();
    this.chunks.syncVisibleChunks(input.cache, { x: this.camX, y: this.camY, radius: preset.chunkRadius });
    const halfX = (this.app.screen.width * 0.5) / (this.zoom * TILE_PX);
    const halfY = (this.app.screen.height * 0.5) / (this.zoom * TILE_PX);
    const viewBounds = { minX: this.camX - halfX, maxX: this.camX + halfX, minY: this.camY - halfY, maxY: this.camY + halfY };
    const { lights, campfires, casters } = this.chunks.syncPlayersAndAtmosphere({
      cache: input.cache, players: input.players, entities: input.entities ?? [], localPlayerId: input.localPlayerId, viewBounds, timeSec: input.timeSec,
    });
    this.renderEffectsAndLighting({ input, local, simDt, lights, campfires, casters, preset });
    this.app.render();
    return { campfireDist: nearestCampfireDist(campfires, local), waterDist: nearestWaterDist(input.cache, local) };
  }

  private renderEffectsAndLighting(opts: {
    readonly input: SceneFrameInput; readonly local: PlayerSnapshot | undefined; readonly simDt: number;
    readonly lights: ReturnType<ChunkRenderer["syncPlayersAndAtmosphere"]>["lights"];
    readonly campfires: ReturnType<ChunkRenderer["syncPlayersAndAtmosphere"]>["campfires"];
    readonly casters: ReturnType<ChunkRenderer["syncPlayersAndAtmosphere"]>["casters"];
    readonly preset: (typeof QUALITY_PRESETS)[QualityPresetId];
  }): void {
    const { input, local, simDt, lights, campfires, casters, preset } = opts;
    const entities = input.entities ?? [];
    this.pickups.sync({ chests: input.chests ?? [], groundLoot: input.groundLoot ?? [], local, cache: input.cache, timeSec: input.timeSec });
    this.hubNpcs.sync(input.cache, local);
    const cursorWorld = input.cursorClient ? this.screenToWorldTile(input.cursorClient.x, input.cursorClient.y) : undefined;
    this.placementGhost.sync({ heldItem: local?.heldItem, player: local, cache: input.cache, cursorWorld, visible: input.ghostEnabled !== false });
    const dayNight = sampleDayNight(input.dayPhase);
    this.castShadows.update(casters, dayNight);
    updateWorldSceneShaders({
      app: this.app, camX: this.camX, camY: this.camY, zoom: this.zoom, timeSec: input.timeSec, dayNight, preset,
      waterEffect: this.waterEffect, grassWind: this.grassWind, canopyWind: this.canopyWind,
      grassWindStrength: CAMERA_TUNING.grassWindStrength, canopyWindStrength: CAMERA_TUNING.canopyWindStrength,
    });
    this.stepSceneParticlesAndGore({ input, local, simDt, lights, campfires, dayNight, preset, entities });
    this.lighting.renderPass({
      renderer: this.app.renderer, width: this.app.screen.width, height: this.app.screen.height,
      lightmapScale: preset.lightmapScale, timeSec: input.timeSec, dayNight,
      camera: { x: this.camX, y: this.camY, zoom: this.zoom }, lights, godRaysEnabled: preset.godRays,
    });
  }

  private stepSceneParticlesAndGore(opts: {
    readonly input: SceneFrameInput; readonly local: PlayerSnapshot | undefined; readonly simDt: number;
    readonly lights: ReturnType<ChunkRenderer["syncPlayersAndAtmosphere"]>["lights"];
    readonly campfires: ReturnType<ChunkRenderer["syncPlayersAndAtmosphere"]>["campfires"];
    readonly dayNight: ReturnType<typeof sampleDayNight>; readonly preset: (typeof QUALITY_PRESETS)[QualityPresetId];
    readonly entities: readonly WorldEntitySnapshot[];
  }): void {
    const { input, local, simDt, lights, campfires, dayNight, preset, entities } = opts;
    this.gore.setTileSampler(input.cache); this.gore.stepBleedDrips(input.players, entities, simDt);
    this.gore.stepFootprints(input.players, entities); this.gore.step(simDt);
    this.webLayer.sync(input.webs, simDt, input.timeSec);
    this.vfx.step({ dt: simDt, projectiles: input.projectiles ?? [], players: input.players, local });
    this.harvestFx.step(simDt);
    this.hitboxDebug.render({ cache: input.cache, local, players: input.players, entities, projectiles: input.projectiles ?? [] });
    const emitters = collectActorParticleEmitters(input.players, entities);
    this.particles.step({
      dt: simDt, timeSec: input.timeSec, dayNight, center: { x: this.camX, y: this.camY },
      biome: sampleMacroBiome(input.cache.worldSeed, this.camX, this.camY),
      maxParticles: preset.maxParticles, campfires, torches: lights.filter((l) => l.kind === "torch"),
      waterActors: collectWaterActors(input.players, entities), ...emitters,
    });
  }

  private syncEvents(input: SceneFrameInput, local: PlayerSnapshot | undefined): void {
    const events = input.events ?? [];
    if (events.length === 0) return;
    this.vfx.handleEvents(events, input.localPlayerId, input.players);
    this.harvestFx.handleEvents(events, input.players, local?.elevation ?? 0);
    const sinks = buildSceneFxSinks({ particles: this.particles, gore: this.gore, cache: input.cache });
    const shake = applyWorldEventsBatch({
      events, localId: input.localPlayerId, entities: input.entities, local,
      leaveSmokeDur: PLAYER_LEAVE_SMOKE_DURATION_SEC, sinks,
    });
    if (shake > 0) this.shakeMag = Math.max(this.shakeMag, shake);
  }

  private followTarget(local: PlayerSnapshot | undefined, dt: number): void {
    const next = stepCameraFollow({ local, dt, camX: this.camX, camY: this.camY, shakeMag: this.shakeMag, shakeTime: this.shakeTime, followLerpRate: CAMERA_TUNING.followLerpRate });
    this.camX = next.camX; this.camY = next.camY; this.shakeMag = next.shakeMag; this.shakeTime = next.shakeTime;
  }

  private syncCameraContainers(): void {
    syncWorldCameraContainers({ app: this.app, filterHosts: this.filterHosts, cameras: this.cameras, camX: this.camX, camY: this.camY, zoom: this.zoom, shakeMag: this.shakeMag, shakeTime: this.shakeTime });
  }
}
