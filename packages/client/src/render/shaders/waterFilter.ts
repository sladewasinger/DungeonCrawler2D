/** PixiJS v8 WebGL2 water shader filter with world-locked ripples and shoreline foam. */
import type { DayNightState } from "@dc2d/engine";
import { Filter, GlProgram, UniformGroup, defaultFilterVert } from "pixi.js";
import { WATER_FRAGMENT_GLSL } from "./glsl/waterGlsl.js";

const F32 = "f32" as const;

export interface WaterUpdateParams {
  readonly timeSec: number;
  readonly enabled: boolean;
  readonly worldOriginX: number;
  readonly worldOriginY: number;
  readonly zoom: number;
  readonly dayNight: DayNightState;
}

export class WaterSurfaceEffect {
  readonly filter: Filter;
  private readonly uniforms: UniformGroup<{
    uTime: { value: number; type: "f32" };
    uEnabled: { value: number; type: "f32" };
    uNightFactor: { value: number; type: "f32" };
    uInvZoom: { value: number; type: "f32" };
    uWorldOrigin: { value: Float32Array; type: "vec2<f32>" };
    uSunColor: { value: Float32Array; type: "vec3<f32>" };
  }>;

  constructor() {
    this.uniforms = new UniformGroup({
      uTime: { value: 0, type: F32 },
      uEnabled: { value: 1, type: F32 },
      uNightFactor: { value: 0, type: F32 },
      uInvZoom: { value: 1, type: F32 },
      uWorldOrigin: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      uSunColor: { value: new Float32Array([1, 0.96, 0.88]), type: "vec3<f32>" },
    });
    const glProgram = GlProgram.from({
      vertex: defaultFilterVert,
      fragment: WATER_FRAGMENT_GLSL,
      preferredFragmentPrecision: "highp",
    });
    this.filter = new Filter({
      glProgram,
      resources: { waterUniforms: this.uniforms },
    });
  }

  update(params: WaterUpdateParams): void {
    const u = this.uniforms.uniforms;
    u.uTime = params.timeSec;
    u.uEnabled = params.enabled ? 1 : 0;
    u.uNightFactor = params.dayNight.nightFactor;
    u.uInvZoom = 1 / Math.max(0.25, params.zoom);
    u.uWorldOrigin[0] = params.worldOriginX;
    u.uWorldOrigin[1] = params.worldOriginY;
    u.uSunColor[0] = params.dayNight.sunRgb[0];
    u.uSunColor[1] = params.dayNight.sunRgb[1];
    u.uSunColor[2] = params.dayNight.sunRgb[2];
    this.uniforms.update();
  }
}
