/** Top-level PixiJS v8 overworld scene coordinating shaders, camera, and quality scaling. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import { TILE_PX, WorldChunkCache, clamp, sampleDayNight, type PlayerSnapshot } from "@dc2d/engine";
import { Application, Container } from "pixi.js";
import { AmbientParticleLayer } from "../shaders/ambientParticles.js";
import { CastShadowLayer } from "../shaders/castShadows.js";
import { FoliageWindEffect } from "../shaders/foliageWindFilter.js";
import { LightingSystem } from "../shaders/lightingSystem.js";
import { reportShaderDiagnostics } from "../shaders/shaderDiag.js";
import { WaterSurfaceEffect } from "../shaders/waterFilter.js";
import { createPropTextureSet } from "../textures/propTextures.js";
import { createTerrainTileAtlas } from "../textures/terrainTextures.js";
import { ChunkRenderer } from "./chunkRenderer.js";
import { loadKnightFrames } from "./playerSprite.js";

export interface SceneFrameInput {
  readonly dt: number;
  readonly timeSec: number;
  readonly dayPhase: number;
  readonly cache: WorldChunkCache;
  readonly players: readonly PlayerSnapshot[];
  readonly localPlayerId: string;
}

export class WorldScene {
  private readonly sceneRoot = new Container();
  private readonly cameras: readonly Container[];
  private readonly filterHosts: readonly Container[];
  private readonly waterEffect = new WaterSurfaceEffect();
  private readonly grassWind = new FoliageWindEffect();
  private readonly canopyWind = new FoliageWindEffect();
  private readonly castShadows = new CastShadowLayer();
  private readonly particles = new AmbientParticleLayer();
  private readonly lighting: LightingSystem;
  private readonly chunks: ChunkRenderer;
  private qualityId: QualityPresetId = "high";
  private camX = 0.5;
  private camY = 0.5;
  private zoom = 2.8;

  private constructor(private readonly app: Application) {
    const [groundCam, waterCam, shadowCam, grassCam, ysortCam, canopyCam, emissiveCam] =
      Array.from({ length: 7 }, () => new Container());
    ysortCam!.sortableChildren = true;
    this.cameras = [groundCam!, waterCam!, shadowCam!, grassCam!, ysortCam!, canopyCam!, emissiveCam!];
    const [waterHost, grassHost, canopyHost] = [new Container(), new Container(), new Container()];
    this.filterHosts = [this.sceneRoot, waterHost, grassHost, canopyHost];
    waterHost.addChild(waterCam!);
    grassHost.addChild(grassCam!);
    canopyHost.addChild(canopyCam!);
    shadowCam!.addChild(this.castShadows.container);
    emissiveCam!.addChild(this.particles.container);
    waterHost.filters = [this.waterEffect.filter];
    grassHost.filters = [this.grassWind.filter];
    canopyHost.filters = [this.canopyWind.filter];
    this.lighting = new LightingSystem(app.screen.width, app.screen.height);
    this.sceneRoot.filters = [this.lighting.filter];
    this.sceneRoot.addChild(groundCam!, waterHost, shadowCam!, grassHost, ysortCam!, canopyHost);
    app.stage.addChild(this.sceneRoot, emissiveCam!);
    const terrain = createTerrainTileAtlas();
    const props = createPropTextureSet();
    this.chunks = new ChunkRenderer(
      { ground: groundCam!, water: waterCam!, grass: grassCam!, ysort: ysortCam!, canopy: canopyCam! },
      { terrain, props },
      { idle: [props.fallbackKnight], run: [props.fallbackKnight] },
    );
    void loadKnightFrames(props.fallbackKnight).then((frames) => this.chunks.setKnightFrames(frames));
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

  adjustZoom(factor: number): void { this.zoom = clamp(this.zoom * factor, 1.6, 5); }

  renderFrame(input: SceneFrameInput): void {
    const preset = QUALITY_PRESETS[this.qualityId];
    const local = input.players.find((p) => p.id === input.localPlayerId) ?? input.players[0];
    this.followTarget(local, input.dt);
    this.syncCameraContainers();
    this.chunks.syncVisibleChunks(input.cache, { x: this.camX, y: this.camY, radius: preset.chunkRadius });
    const { lights, campfires, casters } = this.chunks.syncPlayersAndAtmosphere({ cache: input.cache, players: input.players, timeSec: input.timeSec });
    const dayNight = sampleDayNight(input.dayPhase);
    this.castShadows.update(casters, dayNight);
    this.updateShaders({ timeSec: input.timeSec, dayNight, preset });
    this.particles.step({
      dt: input.dt, timeSec: input.timeSec, dayNight, center: { x: this.camX, y: this.camY },
      maxParticles: preset.maxParticles, campfires, playerWading: Boolean(local?.inWater && local.moving),
    });
    this.lighting.renderPass({
      renderer: this.app.renderer, width: this.app.screen.width, height: this.app.screen.height,
      lightmapScale: preset.lightmapScale, timeSec: input.timeSec, dayNight,
      camera: { x: this.camX, y: this.camY, zoom: this.zoom }, lights, godRaysEnabled: preset.godRays,
    });
    this.app.render();
  }

  private followTarget(local: PlayerSnapshot | undefined, dt: number): void {
    if (!local) return;
    const follow = Math.min(1, dt * 9);
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
    const grassStrength = input.preset.windShader ? 1.4 : 0;
    const canopyStrength = input.preset.windShader ? 0.9 : 0;
    this.grassWind.update({ timeSec: input.timeSec, windStrength: grassStrength, worldOriginX, worldOriginY, zoom: this.zoom });
    this.canopyWind.update({ timeSec: input.timeSec, windStrength: canopyStrength, worldOriginX, worldOriginY, zoom: this.zoom });
  }
}
