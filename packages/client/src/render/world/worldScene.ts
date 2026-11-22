/** Top-level PixiJS v8 overworld scene coordinating shaders, camera, and quality scaling. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import {
  GroundKind, TILE_PX, WorldChunkCache, clamp, sampleDayNight,
  type PlayerSnapshot, type PointLightSpec, type ProjectileSnapshot,
  type WorldEntitySnapshot, type WorldEvent,
} from "@dc2d/engine";
import { Application, Container } from "pixi.js";
import { CombatVfxLayer } from "../combat/combatVfx.js";
import { GoreSystem } from "../combat/goreSystem.js";
import { AmbientParticleLayer } from "../shaders/ambientParticles.js";
import { CastShadowLayer } from "../shaders/castShadows.js";
import { FoliageWindEffect } from "../shaders/foliageWindFilter.js";
import { LightingSystem } from "../shaders/lightingSystem.js";
import { reportShaderDiagnostics } from "../shaders/shaderDiag.js";
import { WaterSurfaceEffect } from "../shaders/waterFilter.js";
import { createPropTextureSet } from "../textures/propTextures.js";
import { createTerrainTileAtlas } from "../textures/terrainTextures.js";
import { ChunkRenderer } from "./chunkRenderer.js";

export interface SceneFrameInput {
  readonly dt: number;
  readonly timeSec: number;
  readonly dayPhase: number;
  readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[];
  readonly localPlayerId: string;
  readonly projectiles?: readonly ProjectileSnapshot[];
  readonly entities?: readonly WorldEntitySnapshot[];
  readonly events?: readonly WorldEvent[];
}

export interface SceneAudioDistances {
  readonly campfireDist: number;
  readonly waterDist: number;
}

function nearestCampfireDist(campfires: readonly PointLightSpec[], local: PlayerSnapshot | undefined): number {
  if (!local || campfires.length === 0) return 99;
  let best = 99;
  for (const fire of campfires) {
    const d = Math.hypot(fire.x - local.x, fire.y - local.y);
    if (d < best) best = d;
  }
  return best;
}

const WATER_PROBE_RING: readonly (readonly [number, number])[] = [
  [-2, 0], [2, 0], [0, -2], [0, 2], [-4, -4], [0, -4], [4, -4],
  [-4, 0], [4, 0], [-4, 4], [0, 4], [4, 4], [-6, 0], [6, 0], [0, -6], [0, 6],
];

function nearestWaterDist(cache: WorldChunkCache, local: PlayerSnapshot | undefined): number {
  if (!local) return 99;
  if (local.inWater) return 0;
  const cx = Math.floor(local.x);
  const cy = Math.floor(local.y);
  let best = 99;
  for (const [dx, dy] of WATER_PROBE_RING) {
    const g = cache.tileAt(cx + dx, cy + dy).ground;
    if (g === GroundKind.ShallowWater || g === GroundKind.DeepWater) {
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}

function resolveEventElev(id: string | undefined, entities: readonly WorldEntitySnapshot[] | undefined, local: PlayerSnapshot | undefined): number {
  const match = id ? entities?.find((e) => e.id === id) : undefined;
  return match?.elevation ?? local?.elevation ?? 0;
}

function buildGoreSpawn(ev: WorldEvent, elevation: number) {
  return {
    x: ev.x, y: ev.y, elevation,
    dirX: ev.dirX ?? 0, dirY: ev.dirY ?? 1,
    style: ev.goreStyle!, substance: ev.substance!,
  };
}

export const CAMERA_TUNING = {
  defaultZoom: 3.8,
  minZoom: 1.6,
  maxZoom: 5.0,
  followLerpRate: 9,
  hitstopTimeScale: 0.12,
  grassWindStrength: 1.4,
  canopyWindStrength: 0.9,
} as const;

export class WorldScene {
  private readonly sceneRoot = new Container();
  private readonly cameras: readonly Container[];
  private readonly filterHosts: readonly Container[];
  private readonly waterEffect = new WaterSurfaceEffect();
  private readonly grassWind = new FoliageWindEffect();
  private readonly canopyWind = new FoliageWindEffect();
  private readonly castShadows = new CastShadowLayer();
  private readonly particles = new AmbientParticleLayer();
  private readonly gore = new GoreSystem();
  private readonly vfx = new CombatVfxLayer();
  private readonly lighting: LightingSystem;
  private readonly chunks: ChunkRenderer;
  private qualityId: QualityPresetId = "high";
  private camX = 0.5;
  private camY = 0.5;
  private zoom: number = CAMERA_TUNING.defaultZoom;

  private constructor(private readonly app: Application) {
    const [groundCam, waterCam, shadowCam, goreCam, grassCam, ysortCam, canopyCam, emissiveCam] =
      Array.from({ length: 8 }, () => new Container());
    ysortCam!.sortableChildren = true;
    this.cameras = [groundCam!, waterCam!, shadowCam!, goreCam!, grassCam!, ysortCam!, canopyCam!, emissiveCam!];
    const [waterHost, grassHost, canopyHost] = [new Container(), new Container(), new Container()];
    this.filterHosts = [this.sceneRoot, waterHost, grassHost, canopyHost];
    waterHost.addChild(waterCam!);
    grassHost.addChild(grassCam!);
    canopyHost.addChild(canopyCam!);
    shadowCam!.addChild(this.castShadows.container);
    goreCam!.addChild(this.gore.decalLayer);
    this.gore.particleLayer.zIndex = 100_000;
    ysortCam!.addChild(this.gore.particleLayer);
    emissiveCam!.addChild(this.particles.container, this.vfx.container);
    waterHost.filters = [this.waterEffect.filter];
    grassHost.filters = [this.grassWind.filter];
    canopyHost.filters = [this.canopyWind.filter];
    this.lighting = new LightingSystem(app.screen.width, app.screen.height);
    this.sceneRoot.filters = [this.lighting.filter];
    this.sceneRoot.addChild(groundCam!, waterHost, shadowCam!, goreCam!, grassHost, ysortCam!, canopyHost);
    app.stage.addChild(this.sceneRoot, emissiveCam!);
    const terrain = createTerrainTileAtlas();
    const props = createPropTextureSet();
    this.chunks = new ChunkRenderer(
      { ground: groundCam!, water: waterCam!, grass: grassCam!, ysort: ysortCam!, canopy: canopyCam! },
      { terrain, props },
    );
    reportShaderDiagnostics(app.renderer, [
      { name: "water", filter: this.waterEffect.filter },
      { name: "wind", filter: this.grassWind.filter },
      { name: "lighting", filter: this.lighting.filter },
    ]);
  }

  static async mount(host: HTMLElement): Promise<WorldScene> {
    const app = new Application();
    await app.init({
      resizeTo: host, preference: "webgl", antialias: false, roundPixels: true, autoStart: false,
      backgroundColor: 0x0d131a, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true,
    });
    host.appendChild(app.canvas);
    return new WorldScene(app);
  }

  setQualityPreset(presetId: QualityPresetId): void {
    this.qualityId = presetId;
    this.app.renderer.resolution = Math.min(QUALITY_PRESETS[presetId].maxDpr, window.devicePixelRatio || 1);
    this.app.resize();
  }

  qualityPreset(): QualityPresetId { return this.qualityId; }

  adjustZoom(factor: number): void { this.zoom = clamp(this.zoom * factor, CAMERA_TUNING.minZoom, CAMERA_TUNING.maxZoom); }

  screenToWorldTile(clientX: number, clientY: number): { readonly x: number; readonly y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const sx = ((clientX - rect.left) * sw) / Math.max(1, rect.width);
    const sy = ((clientY - rect.top) * sh) / Math.max(1, rect.height);
    return {
      x: ((sx - sw * 0.5) / this.zoom + this.camX * TILE_PX) / TILE_PX,
      y: ((sy - sh * 0.5) / this.zoom + this.camY * TILE_PX) / TILE_PX,
    };
  }

  renderFrame(input: SceneFrameInput): SceneAudioDistances {
    const preset = QUALITY_PRESETS[this.qualityId];
    const local = input.players.find((p) => p.id === input.localPlayerId) ?? input.players[0];
    this.syncEvents(input, local);
    const simDt = this.vfx.consumeHitstop(input.dt) ? input.dt * CAMERA_TUNING.hitstopTimeScale : input.dt;
    this.followTarget(local, input.dt);
    this.syncCameraContainers();
    this.chunks.syncVisibleChunks(input.cache, { x: this.camX, y: this.camY, radius: preset.chunkRadius });
    const { lights, campfires, casters } = this.chunks.syncPlayersAndAtmosphere({
      cache: input.cache, players: input.players, entities: input.entities ?? [], timeSec: input.timeSec,
    });
    const dayNight = sampleDayNight(input.dayPhase);
    this.castShadows.update(casters, dayNight);
    this.updateShaders({ timeSec: input.timeSec, dayNight, preset });
    this.gore.stepBleedDrips(input.players, input.entities ?? [], simDt);
    this.gore.step(simDt);
    this.vfx.step({ dt: simDt, projectiles: input.projectiles ?? [], players: input.players, local });
    this.particles.step({
      dt: simDt, timeSec: input.timeSec, dayNight, center: { x: this.camX, y: this.camY },
      maxParticles: preset.maxParticles, campfires, playerWading: Boolean(local?.inWater && local.moving),
    });
    this.lighting.renderPass({
      renderer: this.app.renderer, width: this.app.screen.width, height: this.app.screen.height,
      lightmapScale: preset.lightmapScale, timeSec: input.timeSec, dayNight,
      camera: { x: this.camX, y: this.camY, zoom: this.zoom }, lights, godRaysEnabled: preset.godRays,
    });
    this.app.render();
    return { campfireDist: nearestCampfireDist(campfires, local), waterDist: nearestWaterDist(input.cache, local) };
  }

  private syncEvents(input: SceneFrameInput, local: PlayerSnapshot | undefined): void {
    const events = input.events ?? [];
    if (events.length === 0) return;
    this.vfx.handleEvents(events, input.localPlayerId, input.players);
    for (const ev of events) this.spawnEventGore(ev, input.entities, local);
  }

  private spawnEventGore(ev: WorldEvent, entities: readonly WorldEntitySnapshot[] | undefined, local: PlayerSnapshot | undefined): void {
    if (ev.kind !== "hit" || !ev.goreStyle || !ev.substance) return;
    this.gore.spawn(buildGoreSpawn(ev, resolveEventElev(ev.targetId, entities, local)));
  }

  private followTarget(local: PlayerSnapshot | undefined, dt: number): void {
    if (!local) return;
    const follow = Math.min(1, dt * CAMERA_TUNING.followLerpRate);
    this.camX += (local.x - this.camX) * follow;
    this.camY += (local.y - local.elevation * 0.625 - this.camY) * follow;
  }

  private syncCameraContainers(): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    for (const host of this.filterHosts) host.filterArea = this.app.screen;
    for (const cam of this.cameras) {
      cam.position.set(sw * 0.5, sh * 0.5);
      cam.pivot.set(this.camX * TILE_PX, this.camY * TILE_PX);
      cam.scale.set(this.zoom);
    }
  }

  private updateShaders(input: {
    readonly timeSec: number;
    readonly dayNight: ReturnType<typeof sampleDayNight>;
    readonly preset: (typeof QUALITY_PRESETS)[QualityPresetId];
  }): void {
    const worldOriginX = this.camX * TILE_PX - (this.app.screen.width * 0.5) / this.zoom;
    const worldOriginY = this.camY * TILE_PX - (this.app.screen.height * 0.5) / this.zoom;
    this.waterEffect.update({ timeSec: input.timeSec, enabled: input.preset.waterShader, worldOriginX, worldOriginY, zoom: this.zoom, dayNight: input.dayNight });
    const grassStrength = input.preset.windShader ? CAMERA_TUNING.grassWindStrength : 0;
    const canopyStrength = input.preset.windShader ? CAMERA_TUNING.canopyWindStrength : 0;
    this.grassWind.update({ timeSec: input.timeSec, windStrength: grassStrength, worldOriginX, worldOriginY, zoom: this.zoom });
    this.canopyWind.update({ timeSec: input.timeSec, windStrength: canopyStrength, worldOriginX, worldOriginY, zoom: this.zoom });
  }
}
