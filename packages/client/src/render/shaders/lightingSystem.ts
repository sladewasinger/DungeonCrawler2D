/** Screen-space RenderTexture lightmap and full WebGL2 atmosphere composite pass. */
import type { DayNightState, PointLightSpec } from "@dc2d/engine";
import { TILE_PX } from "@dc2d/engine";
import { Container, Filter, GlProgram, RenderTexture, Sprite, Texture, UniformGroup, defaultFilterVert, type Renderer } from "pixi.js";
import { LIGHTING_COMPOSITE_FRAGMENT_GLSL } from "./glsl/lightingCompositeGlsl.js";

const F32 = "f32" as const;

export interface LightPassInput {
  readonly renderer: Renderer;
  readonly width: number;
  readonly height: number;
  readonly lightmapScale: number;
  readonly timeSec: number;
  readonly dayNight: DayNightState;
  readonly camera: { readonly x: number; readonly y: number; readonly zoom: number };
  readonly lights: readonly PointLightSpec[];
  readonly godRaysEnabled: boolean;
}

export class LightingSystem {
  readonly filter: Filter;
  private readonly lightTexture: RenderTexture;
  private readonly lightContainer = new Container();
  private readonly lightPool: Sprite[] = [];
  private readonly glowTex: Texture;
  private readonly uniforms: UniformGroup<{
    uTime: { value: number; type: "f32" };
    uBloomStrength: { value: number; type: "f32" };
    uSunbeamStrength: { value: number; type: "f32" };
    uCloudAlpha: { value: number; type: "f32" };
    uNightFactor: { value: number; type: "f32" };
    uInvZoom: { value: number; type: "f32" };
    uWorldOrigin: { value: Float32Array; type: "vec2<f32>" };
    uSunColor: { value: Float32Array; type: "vec3<f32>" };
    uFogColor: { value: Float32Array; type: "vec3<f32>" };
  }>;

  constructor(width: number, height: number) {
    this.lightTexture = RenderTexture.create({
      width: Math.max(64, Math.round(width * 0.5)),
      height: Math.max(64, Math.round(height * 0.5)),
      dynamic: true,
      scaleMode: "linear",
    });
    this.glowTex = createRadialLightTexture();
    this.uniforms = new UniformGroup({
      uTime: { value: 0, type: F32 },
      uBloomStrength: { value: 0.35, type: F32 },
      uSunbeamStrength: { value: 0.65, type: F32 },
      uCloudAlpha: { value: 0.28, type: F32 },
      uNightFactor: { value: 0, type: F32 },
      uInvZoom: { value: 1, type: F32 },
      uWorldOrigin: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      uSunColor: { value: new Float32Array([1, 0.96, 0.88]), type: "vec3<f32>" },
      uFogColor: { value: new Float32Array([0.7, 0.82, 0.78]), type: "vec3<f32>" },
    });
    const glProgram = GlProgram.from({
      vertex: defaultFilterVert,
      fragment: LIGHTING_COMPOSITE_FRAGMENT_GLSL,
      preferredFragmentPrecision: "highp",
    });
    this.filter = new Filter({
      glProgram,
      resources: {
        compositeUniforms: this.uniforms,
        uLightMap: this.lightTexture.source,
      },
    });
  }

  renderPass(input: LightPassInput): void {
    const targetW = Math.max(64, Math.round(input.width * input.lightmapScale));
    const targetH = Math.max(64, Math.round(input.height * input.lightmapScale));
    if (this.lightTexture.width !== targetW || this.lightTexture.height !== targetH) {
      this.lightTexture.resize(targetW, targetH);
      this.filter.resources.uLightMap = this.lightTexture.source;
    }
    this.populateLightSprites(input, targetW, targetH);
    const [ar, ag, ab] = input.dayNight.ambientRgb;
    input.renderer.render({
      container: this.lightContainer,
      target: this.lightTexture,
      clear: true,
      clearColor: [ar, ag, ab, 1],
    });
    this.syncUniforms(input);
  }

  private populateLightSprites(input: LightPassInput, targetW: number, targetH: number): void {
    const { camera, timeSec, dayNight, lights } = input;
    const scaleX = targetW / Math.max(1, input.width);
    const scaleY = targetH / Math.max(1, input.height);
    const halfW = input.width * 0.5;
    const halfH = input.height * 0.5;
    let used = 0;

    for (const light of lights) {
      const sprite = this.acquireSprite(used++);
      const screenX = halfW + (light.x * TILE_PX - camera.x * TILE_PX) * camera.zoom;
      const screenY = halfH + (light.y * TILE_PX - camera.y * TILE_PX) * camera.zoom;
      const flicker = 0.94 + 0.06 * Math.sin(timeSec * 2.1 + light.x * 1.7 + light.y * 2.3);
      const dia = light.radiusPx * 2 * camera.zoom * flicker;
      sprite.position.set(screenX * scaleX, screenY * scaleY);
      sprite.width = dia * scaleX;
      sprite.height = dia * scaleY;
      sprite.tint = light.color;
      sprite.alpha = Math.min(1.0, light.intensity * (0.48 + dayNight.nightFactor * 0.52) * flicker);
      sprite.visible = true;
    }
    for (let i = used; i < this.lightPool.length; i++) {
      const idle = this.lightPool[i];
      if (idle) idle.visible = false;
    }
  }

  private acquireSprite(index: number): Sprite {
    const existing = this.lightPool[index];
    if (existing) return existing;
    const created = new Sprite(this.glowTex);
    created.anchor.set(0.5);
    created.blendMode = "add";
    this.lightPool.push(created);
    this.lightContainer.addChild(created);
    return created;
  }

  private syncUniforms(input: LightPassInput): void {
    const { dayNight, camera, timeSec } = input;
    const u = this.uniforms.uniforms;
    u.uTime = timeSec;
    u.uBloomStrength = dayNight.bloomStrength;
    u.uSunbeamStrength = input.godRaysEnabled ? dayNight.sunbeamStrength : 0;
    u.uCloudAlpha = dayNight.cloudShadowAlpha;
    u.uNightFactor = dayNight.nightFactor;
    u.uInvZoom = 1 / Math.max(0.25, camera.zoom);
    u.uWorldOrigin[0] = camera.x * TILE_PX - (input.width * 0.5) / camera.zoom;
    u.uWorldOrigin[1] = camera.y * TILE_PX - (input.height * 0.5) / camera.zoom;
    u.uSunColor.set(dayNight.sunRgb);
    u.uFogColor.set(dayNight.fogRgb);
    this.uniforms.update();
  }
}

function createRadialLightTexture(): Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable for light glow");
  const half = size * 0.5;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0, "rgba(255, 250, 235, 1)");
  grad.addColorStop(0.32, "rgba(255, 235, 200, 0.72)");
  grad.addColorStop(0.68, "rgba(255, 200, 140, 0.24)");
  grad.addColorStop(1, "rgba(255, 180, 120, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return Texture.from({ resource: canvas, scaleMode: "linear" });
}
