// Per-hazard particle recipes: fire, poison, and steam get live emitters (layered
// flame+embers, drifting bubbles, billowing steam); oil/wet are static glossy overlays
// since neither hazard is itself alight — per VISUAL_DIRECTION's "particles + light, not
// recolored rectangles" rule, fire is the light that reads as "burning", not oil.
import Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../boot/assetManifest.js";

const FRAME = "light_soft";
/** Above every terrain/entity depth, below the darkness overlay (render/lighting/darkness.ts) — atmospheric, not occluded by walls. */
const PARTICLE_LAYER_DEPTH = 210_000;

function baseEmitter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(x, y, ASSET_KEYS.atlas, { frame: FRAME, ...config }).setDepth(PARTICLE_LAYER_DEPTH);
}

/** Layered flame core + slower rising embers over a ground fire tile. */
export function createFireEmitters(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter[] {
  const flame = baseEmitter(scene, x, y, {
    lifespan: 380,
    speed: { min: 6, max: 18 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.22, end: 0 },
    alpha: { start: 0.85, end: 0 },
    tint: [0xffd23d, 0xff9e3d, 0xe04a4a],
    frequency: 45,
    blendMode: "ADD",
  });
  const embers = baseEmitter(scene, x, y, {
    lifespan: 700,
    speed: { min: 4, max: 14 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.1, end: 0 },
    alpha: { start: 0.7, end: 0 },
    tint: 0xff9e3d,
    frequency: 140,
    blendMode: "ADD",
  });
  return [flame, embers];
}

/** A tighter, cheaper flame lick for wall torches — many can be on screen at once. */
export function createTorchFlame(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  return baseEmitter(scene, x, y, {
    lifespan: 320,
    speed: { min: 4, max: 12 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.16, end: 0 },
    alpha: { start: 0.8, end: 0 },
    tint: [0xffd23d, 0xff9e3d],
    frequency: 70,
    blendMode: "ADD",
  });
}

/** Slow drifting bubbles over a poison tile. */
export function createPoisonEmitter(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  return baseEmitter(scene, x, y, {
    lifespan: 1100,
    speed: { min: 3, max: 9 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.14, end: 0.05 },
    alpha: { start: 0.55, end: 0 },
    tint: 0x7bd44a,
    frequency: 160,
    blendMode: "ADD",
  });
}

/** Wide, fast-fading steam billow. */
export function createSteamEmitter(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  return baseEmitter(scene, x, y, {
    lifespan: 650,
    speed: { min: 8, max: 22 },
    angle: { min: 255, max: 285 },
    scale: { start: 0.3, end: 0.55 },
    alpha: { start: 0.4, end: 0 },
    tint: 0xd8dde6,
    frequency: 90,
    blendMode: "ADD",
  });
}

const OIL_TINT = 0x1a1420;
const WET_TINT = 0x3d5a66;

/** Static glossy overlay for an unlit hazard puddle (oil/wet) — a subtle sheen, no particles. */
export function createSheenOverlay(scene: Phaser.Scene, x: number, y: number, wet: boolean): Phaser.GameObjects.Image {
  return scene.add
    .image(x, y, ASSET_KEYS.atlas, FRAME)
    .setTint(wet ? WET_TINT : OIL_TINT)
    .setAlpha(0.4)
    .setScale((SCREEN_TILE_PX * 1.1) / 64)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setDepth(PARTICLE_LAYER_DEPTH - 1);
}
