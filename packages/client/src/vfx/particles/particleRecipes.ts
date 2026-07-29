// Per-hazard particle recipes used by the bounded area-rig pool. Ground puddle
// topology is rendered separately; these recipes add motion without duplicating it.
import type Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";
import {
  AREA_EMISSION_FREQUENCIES,
  AREA_EMISSION_LIFETIMES,
  AREA_FIRE_FIELD,
} from "../areas/presentation/areaVisualStyle.js";
import { createParticleEmitter } from "./particleEmitterFactory.js";
import {
  FLOOR_FIRE_FLAME_PRESENTATION,
  FIRE_SPARK_PRESENTATION,
  floorFireParticleScale,
} from "./fireParticlePresentation.js";

const EMBER_FRAME = "chunk_small";
const LUMINOUS_SOURCE_PARTICLE_DEPTH = 210_000;

interface AreaEmitterInput {
  readonly scene: Phaser.Scene;
  readonly x: number;
  readonly y: number;
  readonly frequencyScale: number;
}

export interface RandomEmissionSource {
  getRandomPoint(point: { x: number; y: number }): void;
}

export interface FireEmitterSet {
  readonly flame: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly all: readonly Phaser.GameObjects.Particles.ParticleEmitter[];
}

interface FireEmitterInput extends AreaEmitterInput {
  readonly source: RandomEmissionSource;
}

/** Layered flame core + slower rising embers over a ground fire tile. */
export function createFireEmitters(
  input: FireEmitterInput,
): FireEmitterSet {
  const { scene, x, y, frequencyScale } = input;
  const flame = createParticleEmitter(scene, {
    x,
    y,
    frame: FLOOR_FIRE_FLAME_PRESENTATION.frame,
    config: fireFlameConfig(frequencyScale),
  });
  const embers = createParticleEmitter(scene, {
    x,
    y,
    texture: ASSET_KEYS.particleAtlas,
    frame: EMBER_FRAME,
    config: fireEmberConfig(frequencyScale),
  });
  const sparks = createFireSparks(input);
  const emitters = [flame, embers, sparks];
  for (const emitter of emitters) {
    emitter.addEmitZone({ type: "random", source: input.source });
  }
  return { flame, all: emitters };
}

export function fireFlameConfig(
  frequencyScale: number,
): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  const flame = FLOOR_FIRE_FLAME_PRESENTATION;
  const frequency = AREA_EMISSION_FREQUENCIES.fire.flame;
  return {
    lifespan: AREA_EMISSION_LIFETIMES.fire.flame,
    delay: { min: 0, max: frequency },
    speed: flame.speed,
    angle: flame.angle,
    rotate: flame.rotate,
    scale: flame.scale,
    alpha: flame.alpha,
    tint: [...flame.tints],
    frequency: frequency * frequencyScale,
    maxAliveParticles: AREA_FIRE_FIELD.maximumLiveFlames,
    blendMode: "ADD",
  };
}

function fireEmberConfig(
  frequencyScale: number,
): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
  return {
    lifespan: AREA_EMISSION_LIFETIMES.fire.ember,
    speed: { min: 7, max: 20 },
    angle: { min: 250, max: 290 },
    scale: floorFireParticleScale("ember"),
    alpha: { start: 0.7, end: 0 },
    tint: 0xff9e3d,
    frequency: AREA_EMISSION_FREQUENCIES.fire.ember * frequencyScale,
    blendMode: "ADD",
  };
}

function createFireSparks(
  input: AreaEmitterInput,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const { scene, x, y, frequencyScale } = input;
  return createParticleEmitter(scene, { x, y, texture: ASSET_KEYS.particleAtlas, frame: FIRE_SPARK_PRESENTATION.frame, config: {
    lifespan: AREA_EMISSION_LIFETIMES.fire.spark,
    speed: FIRE_SPARK_PRESENTATION.speed,
    angle: FIRE_SPARK_PRESENTATION.angle,
    gravityY: FIRE_SPARK_PRESENTATION.gravityY,
    scale: floorFireParticleScale("spark"),
    alpha: FIRE_SPARK_PRESENTATION.alpha,
    tint: [...FIRE_SPARK_PRESENTATION.tints],
    frequency: AREA_EMISSION_FREQUENCIES.fire.spark * frequencyScale,
    blendMode: "ADD",
  }});
}

/** A tighter, cheaper flame lick for wall torches — many can be on screen at once. */
export function createTorchFlame(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  return createParticleEmitter(scene, { x, y, config: {
    lifespan: 320,
    speed: { min: 4, max: 12 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.16, end: 0 },
    alpha: { start: 0.8, end: 0 },
    tint: [0xffd23d, 0xff9e3d],
    frequency: 70,
    blendMode: "ADD",
  }}).setDepth(LUMINOUS_SOURCE_PARTICLE_DEPTH);
}

/** Wide, fast-fading steam billow. */
export function createSteamEmitter(
  input: AreaEmitterInput,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const { scene, x, y, frequencyScale } = input;
  return createParticleEmitter(scene, { x, y, config: {
    lifespan: 650,
    speed: { min: 8, max: 22 },
    angle: { min: 255, max: 285 },
    scale: { start: 0.3, end: 0.55 },
    alpha: { start: 0.4, end: 0 },
    tint: 0xd8dde6,
    frequency: AREA_EMISSION_FREQUENCIES.steam * frequencyScale,
    blendMode: "ADD",
  }});
}
