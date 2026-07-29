import Phaser from "phaser";
import { ASSET_KEYS } from "../../boot/assetManifest.js";

const DEFAULT_FRAME = "light_soft";
const PARTICLE_LAYER_DEPTH = 210_000;

export interface ParticleEmitterRequest {
  readonly config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
  readonly frame?: string;
  readonly texture?: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Creates atmospheric particle emitters above terrain and entities but below the
 * darkness layer. Individual hazard recipes only provide their visual behavior.
 */
export function createParticleEmitter(
  scene: Phaser.Scene,
  request: ParticleEmitterRequest,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(
    request.x,
    request.y,
    request.texture ?? ASSET_KEYS.atlas,
    {
      emitting: false,
      duration: 0,
      stopAfter: 0,
      frame: request.frame ?? DEFAULT_FRAME,
      ...request.config,
    },
  ).setDepth(PARTICLE_LAYER_DEPTH);
}
