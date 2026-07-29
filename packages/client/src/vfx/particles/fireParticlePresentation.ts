import {
  AREA_ACTOR_FIRE_SPARKS,
  AREA_FLOOR_FIRE_FLAME_PARTICLES,
  AREA_FIRE_FLOOR_SCALES,
} from "../areas/presentation/areaVisualStyle.js";

export type FloorFireParticleKind = "flame" | "ember" | "spark";

interface ParticleScale {
  readonly start: number;
  readonly end: number;
  readonly random?: true;
}

const AUTHORED_SCALES: Readonly<
  Record<Exclude<FloorFireParticleKind, "flame">, ParticleScale>
> = {
  ember: { start: 0.75, end: 0.15 },
  spark: { start: 1, end: 0 },
};

export const FLOOR_FIRE_FLAME_PRESENTATION = {
  frame: "area_fire_flame",
  scale: {
    start: AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumScale,
    end: AREA_FLOOR_FIRE_FLAME_PARTICLES.minimumScale,
    random: true,
  },
  speed: {
    min: AREA_FLOOR_FIRE_FLAME_PARTICLES.minimumRiseSpeed,
    max: AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumRiseSpeed,
  },
  angle: {
    min: AREA_FLOOR_FIRE_FLAME_PARTICLES.minimumRiseAngleDegrees,
    max: AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumRiseAngleDegrees,
  },
  x: {
    min: -AREA_FLOOR_FIRE_FLAME_PARTICLES.horizontalSpawnRadiusPx,
    max: AREA_FLOOR_FIRE_FLAME_PARTICLES.horizontalSpawnRadiusPx,
  },
  y: {
    min: AREA_FLOOR_FIRE_FLAME_PARTICLES.minimumSpawnOffsetYPx,
    max: AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumSpawnOffsetYPx,
  },
  rotate: {
    min: -AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumRotationDegrees,
    max: AREA_FLOOR_FIRE_FLAME_PARTICLES.maximumRotationDegrees,
  },
  alpha: { start: AREA_FLOOR_FIRE_FLAME_PARTICLES.alpha, end: 0 },
  tints: AREA_FLOOR_FIRE_FLAME_PARTICLES.colors,
} as const;

export const FIRE_SPARK_PRESENTATION = {
  frame: "chunk_tiny",
  tints: [0xfff0a0, 0xffb12b] as const,
  lifespanMs: 520,
  speed: { min: 18, max: 34 },
  angle: { min: 225, max: 315 },
  gravityY: 24,
  alpha: { start: 0.95, end: 0 },
  actorScale: AREA_ACTOR_FIRE_SPARKS.scale,
  actorAlpha: AREA_ACTOR_FIRE_SPARKS.alpha,
  actorDepthBias: AREA_ACTOR_FIRE_SPARKS.depthBias,
} as const;

export function floorFireParticleScale(
  kind: FloorFireParticleKind,
): ParticleScale {
  if (kind === "flame") return FLOOR_FIRE_FLAME_PRESENTATION.scale;
  const authored = AUTHORED_SCALES[kind];
  const multiplier = AREA_FIRE_FLOOR_SCALES[kind];
  return {
    start: authored.start * multiplier,
    end: authored.end * multiplier,
  };
}

export function fireSparkTint(sequence: number): number {
  const index = Math.abs(sequence) % FIRE_SPARK_PRESENTATION.tints.length;
  return FIRE_SPARK_PRESENTATION.tints[index] ??
    FIRE_SPARK_PRESENTATION.tints[0];
}
