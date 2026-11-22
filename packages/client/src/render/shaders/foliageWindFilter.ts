/** PixiJS v8 WebGL2 foliage wind-wave filter swaying grass and canopies smoothly. */
import { Filter, GlProgram, UniformGroup, defaultFilterVert } from "pixi.js";
import { FOLIAGE_WIND_FRAGMENT_GLSL } from "./glsl/foliageWindGlsl.js";

const F32 = "f32" as const;

export interface WindUpdateParams {
  readonly timeSec: number;
  readonly windStrength: number;
  readonly worldOriginX: number;
  readonly worldOriginY: number;
  readonly zoom: number;
}

export class FoliageWindEffect {
  readonly filter: Filter;
  private readonly uniforms: UniformGroup<{
    uTime: { value: number; type: "f32" };
    uWindStrength: { value: number; type: "f32" };
    uZoom: { value: number; type: "f32" };
    uInvZoom: { value: number; type: "f32" };
    uWorldOrigin: { value: Float32Array; type: "vec2<f32>" };
  }>;

  constructor() {
    this.uniforms = new UniformGroup({
      uTime: { value: 0, type: F32 },
      uWindStrength: { value: 1, type: F32 },
      uZoom: { value: 1, type: F32 },
      uInvZoom: { value: 1, type: F32 },
      uWorldOrigin: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
    });
    const glProgram = GlProgram.from({ vertex: defaultFilterVert, fragment: FOLIAGE_WIND_FRAGMENT_GLSL });
    this.filter = new Filter({
      glProgram,
      resources: { windUniforms: this.uniforms },
    });
  }

  update(params: WindUpdateParams): void {
    const u = this.uniforms.uniforms;
    u.uTime = params.timeSec;
    u.uWindStrength = params.windStrength;
    u.uZoom = params.zoom;
    u.uInvZoom = 1 / Math.max(0.25, params.zoom);
    u.uWorldOrigin[0] = params.worldOriginX;
    u.uWorldOrigin[1] = params.worldOriginY;
    this.uniforms.update();
  }
}
