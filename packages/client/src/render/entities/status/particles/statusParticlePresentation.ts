import { ASSET_KEYS } from "../../../../boot/assetManifest.js";
import { FIRE_SPARK_PRESENTATION } from "../../../../vfx/particles/fireParticlePresentation.js";
import { STATUS_VISUAL_STYLE } from "../../combat/statusVisualStyle.js";
import type { StatusParticleKind } from "./statusParticleMotion.js";

export interface StatusParticlePresentation {
  readonly texture: string;
  readonly frame: string;
  readonly tint: number;
  readonly blendMode: "ADD" | "MULTIPLY";
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
  readonly lifespanMs: number;
  readonly depthBias: number;
}

const OIL_PRESENTATION: StatusParticlePresentation = {
  texture: ASSET_KEYS.atlas,
  frame: "particle_soft",
  tint: 0x17121b,
  blendMode: "MULTIPLY",
  scaleX: 0.08,
  scaleY: 0.15,
  alpha: 0.58,
  lifespanMs: 720,
  depthBias: 0.06,
};

const POISON_GAS_PRESENTATION: StatusParticlePresentation = {
  texture: ASSET_KEYS.atlas,
  frame: "light_soft",
  tint: STATUS_VISUAL_STYLE.poisoned.gas.color,
  blendMode: "ADD",
  scaleX: STATUS_VISUAL_STYLE.poisoned.gas.scale,
  scaleY: STATUS_VISUAL_STYLE.poisoned.gas.scale,
  alpha: STATUS_VISUAL_STYLE.poisoned.gas.alpha,
  lifespanMs: STATUS_VISUAL_STYLE.poisoned.gas.lifespanMs,
  depthBias: STATUS_VISUAL_STYLE.poisoned.gas.depthBias,
};

export function statusParticlePresentation(
  kind: StatusParticleKind,
  sequence: number,
): StatusParticlePresentation {
  if (kind === "oil-drop") return OIL_PRESENTATION;
  if (kind === "poison-gas") return POISON_GAS_PRESENTATION;
  return {
    texture: ASSET_KEYS.particleAtlas,
    frame: FIRE_SPARK_PRESENTATION.frame,
    tint: fireSparkTint(sequence),
    blendMode: "ADD",
    scaleX: FIRE_SPARK_PRESENTATION.actorScale,
    scaleY: FIRE_SPARK_PRESENTATION.actorScale,
    alpha: FIRE_SPARK_PRESENTATION.actorAlpha,
    lifespanMs: FIRE_SPARK_PRESENTATION.lifespanMs,
    depthBias: FIRE_SPARK_PRESENTATION.actorDepthBias,
  };
}

function fireSparkTint(sequence: number): number {
  const index = Math.abs(sequence) % FIRE_SPARK_PRESENTATION.tints.length;
  return FIRE_SPARK_PRESENTATION.tints[index] ??
    FIRE_SPARK_PRESENTATION.tints[0];
}
