import type Phaser from "phaser";
import type { AreaFireFlamePlacement } from "../animation/areaFireFlameStack.js";
import { AREA_FIRE_FIELD } from "../presentation/areaVisualStyle.js";

interface CoreFlameStack {
  sync(placement: AreaFireFlamePlacement): void;
}

export function syncFireFieldCore(
  flames: CoreFlameStack,
  placement: AreaFireFlamePlacement & { readonly showCore: boolean },
  nowMs: number,
): void {
  if (!placement.showCore) return;
  flames.sync({ ...placement, nowMs });
}

export function replenishFireFieldFlames(
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  showCore: boolean,
): void {
  const deficit = fireFieldFlameDeficit({
    alive: emitter.getAliveParticleCount(),
    showCore,
  });
  if (deficit > 0) emitter.emitParticle(deficit);
}

export function fireFieldFlameDeficit(input: {
  readonly alive: number;
  readonly showCore: boolean;
}): number {
  if (input.showCore) return 0;
  return Math.max(0, AREA_FIRE_FIELD.maximumLiveFlames - input.alive);
}
