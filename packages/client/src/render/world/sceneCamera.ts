/** Camera rig setup, shader parameter updates, and follow/shake math extracted cleanly from WorldScene. */
import { QUALITY_PRESETS, type QualityPresetId } from "@dc2d/content";
import { TILE_PX, sampleDayNight, type PlayerSnapshot } from "@dc2d/engine";
import { Application, Container, Rectangle } from "pixi.js";
import type { FoliageWindEffect } from "../shaders/foliageWindFilter.js";
import { getTilemapGlProgram } from "../shaders/tilemapMesh.js";
import { reportShaderDiagnostics } from "../shaders/shaderDiag.js";
import type { LightingSystem } from "../shaders/lightingSystem.js";
import type { WaterSurfaceEffect } from "../shaders/waterFilter.js";

export interface SceneCameraRig {
  readonly sceneRoot: Container;
  readonly cameras: readonly Container[];
  readonly filterHosts: readonly Container[];
  readonly layers: { readonly ground: Container; readonly water: Container; readonly grass: Container; readonly ysort: Container; readonly canopy: Container };
  readonly emissiveCam: Container;
}

export function buildSceneCameraRig(opts: {
  readonly app: Application;
  readonly waterFilter: WaterSurfaceEffect["filter"];
  readonly grassFilter: FoliageWindEffect["filter"];
  readonly canopyFilter: FoliageWindEffect["filter"];
  readonly lightFilter: LightingSystem["filter"];
  readonly grassWindStrength: number;
}): SceneCameraRig {
  const [groundCam, waterCam, shadowCam, goreCam, grassCam, ysortCam, canopyCam, emissiveCam] =
    Array.from({ length: 8 }, () => new Container());
  ysortCam!.sortableChildren = true;
  const cameras = [groundCam!, waterCam!, shadowCam!, goreCam!, grassCam!, ysortCam!, canopyCam!, emissiveCam!];
  const [waterHost, grassHost, canopyHost] = [new Container(), new Container(), new Container()];
  const sceneRoot = new Container();
  const filterHosts = opts.grassWindStrength > 0 ? [sceneRoot, waterHost, grassHost, canopyHost] : [sceneRoot, waterHost, canopyHost];
  waterHost.addChild(waterCam!); grassHost.addChild(grassCam!); canopyHost.addChild(canopyCam!);
  waterHost.filters = [opts.waterFilter];
  if (opts.grassWindStrength > 0) grassHost.filters = [opts.grassFilter];
  canopyHost.filters = [opts.canopyFilter];
  sceneRoot.filters = [opts.lightFilter];
  sceneRoot.addChild(groundCam!, waterHost, shadowCam!, goreCam!, grassHost, ysortCam!, canopyHost);
  opts.app.stage.addChild(sceneRoot, emissiveCam!);
  return {
    sceneRoot, cameras, filterHosts,
    layers: { ground: groundCam!, water: waterCam!, grass: grassCam!, ysort: ysortCam!, canopy: canopyCam! },
    emissiveCam: emissiveCam!,
  };
}

export function reportWorldSceneShaders(opts: {
  readonly renderer: Application["renderer"];
  readonly water: WaterSurfaceEffect["filter"];
  readonly wind: FoliageWindEffect["filter"];
  readonly lighting: LightingSystem["filter"];
}): readonly string[] {
  return reportShaderDiagnostics(opts.renderer, [
    { name: "tilemap", glProgram: getTilemapGlProgram() },
    { name: "water", filter: opts.water },
    { name: "wind", filter: opts.wind },
    { name: "lighting", filter: opts.lighting },
  ]);
}

export function stepCameraFollow(opts: {
  readonly local: PlayerSnapshot | undefined; readonly dt: number;
  readonly camX: number; readonly camY: number; readonly shakeMag: number; readonly shakeTime: number;
  readonly followLerpRate: number;
}): { readonly camX: number; readonly camY: number; readonly shakeMag: number; readonly shakeTime: number } {
  let { camX, camY, shakeMag, shakeTime } = opts;
  shakeTime += opts.dt;
  shakeMag *= Math.exp(-16 * opts.dt);
  if (shakeMag < 0.08) shakeMag = 0;
  if (opts.local) {
    const follow = Math.min(1, opts.dt * opts.followLerpRate);
    camX += (opts.local.x - camX) * follow;
    camY += (opts.local.y - opts.local.elevation * 0.625 - camY) * follow;
  }
  return { camX, camY, shakeMag, shakeTime };
}

export function syncWorldCameraContainers(opts: {
  readonly app: Application; readonly filterHosts: readonly Container[]; readonly cameras: readonly Container[];
  readonly camX: number; readonly camY: number; readonly zoom: number; readonly shakeMag: number; readonly shakeTime: number;
}): void {
  const sw = opts.app.screen.width;
  const sh = opts.app.screen.height;
  const sx = opts.shakeMag > 0 ? Math.sin(opts.shakeTime * 71) * opts.shakeMag : 0;
  const sy = opts.shakeMag > 0 ? Math.cos(opts.shakeTime * 59) * opts.shakeMag : 0;
  for (const host of opts.filterHosts) host.filterArea = (host.filterArea ?? new Rectangle()).copyFrom(opts.app.screen);
  for (const cam of opts.cameras) {
    cam.position.set(sw * 0.5 + sx, sh * 0.5 + sy);
    cam.pivot.set(opts.camX * TILE_PX, opts.camY * TILE_PX);
    cam.scale.set(opts.zoom);
  }
}

export function updateWorldSceneShaders(opts: {
  readonly app: Application; readonly camX: number; readonly camY: number; readonly zoom: number;
  readonly timeSec: number; readonly dayNight: ReturnType<typeof sampleDayNight>;
  readonly preset: (typeof QUALITY_PRESETS)[QualityPresetId];
  readonly waterEffect: WaterSurfaceEffect; readonly grassWind: FoliageWindEffect; readonly canopyWind: FoliageWindEffect;
  readonly grassWindStrength: number; readonly canopyWindStrength: number;
}): void {
  const worldOriginX = opts.camX * TILE_PX - (opts.app.screen.width * 0.5) / opts.zoom;
  const worldOriginY = opts.camY * TILE_PX - (opts.app.screen.height * 0.5) / opts.zoom;
  opts.waterEffect.update({ timeSec: opts.timeSec, enabled: opts.preset.waterShader, worldOriginX, worldOriginY, zoom: opts.zoom, dayNight: opts.dayNight });
  if (opts.grassWindStrength > 0) {
    opts.grassWind.update({ timeSec: opts.timeSec, windStrength: opts.preset.windShader ? opts.grassWindStrength : 0, worldOriginX, worldOriginY, zoom: opts.zoom });
  }
  opts.canopyWind.update({ timeSec: opts.timeSec, windStrength: opts.preset.windShader ? opts.canopyWindStrength : 0, worldOriginX, worldOriginY, zoom: opts.zoom });
}
