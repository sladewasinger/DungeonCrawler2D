import { hexColorToNumber } from "../../../render/style/hexColor.js";
import areaVisualStyle from "./areaVisualStyle.json" with { type: "json" };

export type PuddleKind = "wet" | "oil" | "poison";
export type AnimatedAreaKind = "fire" | "poison" | "steam";

export interface PuddleStyle {
  readonly color: number;
  readonly alpha: number;
  readonly blendMode: "NORMAL" | "MULTIPLY";
}

interface ConfiguredPuddleStyle {
  readonly color: string;
  readonly alpha: number;
  readonly blendMode: string;
}

function puddleStyle(style: ConfiguredPuddleStyle): PuddleStyle {
  return {
    color: hexColorToNumber(style.color, "area puddle color"),
    alpha: style.alpha,
    blendMode: style.blendMode === "MULTIPLY" ? "MULTIPLY" : "NORMAL",
  };
}

export const AREA_CLOUD_ROW_INSET = areaVisualStyle.layers.cloudRowInset;
export const AREA_FIRE_CORE_UNDERLAY_BIAS =
  areaVisualStyle.layers.fireCoreUnderlayBias;
export const AREA_PARTICLE_OVERLAY_INSET =
  areaVisualStyle.layers.particleOverlayInset;
export const MAXIMUM_SPARE_PUDDLE_ROWS =
  areaVisualStyle.layers.maximumSparePuddleRows;
export const PUDDLE_INSET_PX = areaVisualStyle.puddles.insetPx;
export const PUDDLE_CORNER_RADIUS_PX = areaVisualStyle.puddles.cornerRadiusPx;

export const PUDDLE_STYLES: Readonly<Record<PuddleKind, PuddleStyle>> = {
  wet: puddleStyle(areaVisualStyle.puddles.wet),
  oil: puddleStyle(areaVisualStyle.puddles.oil),
  poison: puddleStyle(areaVisualStyle.puddles.poison),
};

export const AREA_LIGHT_STYLES = {
  fire: {
    color: hexColorToNumber(areaVisualStyle.fire.lightColor, "area fire light"),
    radiusTiles: areaVisualStyle.fire.lightRadiusTiles,
  },
  poison: {
    color: hexColorToNumber(areaVisualStyle.poison.lightColor, "area poison light"),
    radiusTiles: areaVisualStyle.poison.lightRadiusTiles,
  },
  steam: {
    color: hexColorToNumber(areaVisualStyle.steam.lightColor, "area steam light"),
    radiusTiles: areaVisualStyle.steam.lightRadiusTiles,
  },
} as const;

export const AREA_EMISSION_FREQUENCIES = {
  fire: {
    flame: areaVisualStyle.fire.flameFrequencyMs,
    ember: areaVisualStyle.fire.emberFrequencyMs,
    spark: areaVisualStyle.fire.sparkFrequencyMs,
  },
  steam: areaVisualStyle.steam.frequencyMs,
} as const;

export const AREA_EMISSION_LIFETIMES = {
  fire: {
    flame: areaVisualStyle.fire.flameLifespanMs,
    ember: areaVisualStyle.fire.emberLifespanMs,
    spark: areaVisualStyle.fire.sparkLifespanMs,
  },
} as const;

export const AREA_FIRE_BASE_FLAME = {
  color: hexColorToNumber(areaVisualStyle.fire.baseFlameColor, "area fire base flame"),
  alpha: areaVisualStyle.fire.baseFlameAlpha,
  scale: areaVisualStyle.fire.floorScaleMultipliers.core,
} as const;

export const AREA_FLOOR_FIRE_FLAMES = {
  periodMs: areaVisualStyle.fire.floorFlames.periodMs,
  horizontalPulsePx: areaVisualStyle.fire.floorFlames.horizontalPulsePx,
  verticalPulsePx: areaVisualStyle.fire.floorFlames.verticalPulsePx,
  layers: areaVisualStyle.fire.floorFlames.layers.map((layer) => ({
    ...layer,
    color: hexColorToNumber(layer.color, "floor fire layer"),
  })),
} as const;

export const AREA_FLOOR_FIRE_FLAME_PARTICLES = {
  ...areaVisualStyle.fire.flameParticles,
  colors: areaVisualStyle.fire.flameParticles.colors.map((color) =>
    hexColorToNumber(color, "floor fire flame particle")
  ),
} as const;

export const AREA_FIRE_FIELD = areaVisualStyle.fire.field;

export const AREA_FIRE_FLOOR_SCALES = {
  core: areaVisualStyle.fire.floorScaleMultipliers.core,
  flame: areaVisualStyle.fire.floorScaleMultipliers.flame,
  ember: areaVisualStyle.fire.floorScaleMultipliers.ember,
  spark: areaVisualStyle.fire.floorScaleMultipliers.spark,
} as const;

export const AREA_ACTOR_FIRE_FLAMES = {
  count: areaVisualStyle.fire.actorFlames.count,
  scale: areaVisualStyle.fire.actorFlames.scale,
  alpha: areaVisualStyle.fire.actorFlames.alpha,
  alphaPulse: areaVisualStyle.fire.actorFlames.alphaPulse,
  pulsePeriodMs: areaVisualStyle.fire.actorFlames.pulsePeriodMs,
  depthBias: areaVisualStyle.fire.actorFlames.depthBias,
  offsets: areaVisualStyle.fire.actorFlames.offsets,
} as const;

export const AREA_ACTOR_FIRE_SPARKS = {
  scale: areaVisualStyle.fire.actorSparks.scale,
  alpha: areaVisualStyle.fire.actorSparks.alpha,
  depthBias: areaVisualStyle.fire.actorSparks.depthBias,
} as const;

export const AREA_POISON_BUBBLES = {
  ...areaVisualStyle.poison.bubbles,
  color: hexColorToNumber(
    areaVisualStyle.poison.bubbles.color,
    "poison bubble",
  ),
} as const;

export const AREA_VISUAL_BUDGETS = areaVisualStyle.budgets;
