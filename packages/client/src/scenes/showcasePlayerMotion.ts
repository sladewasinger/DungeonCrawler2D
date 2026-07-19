// Shared pure trajectory for the gallery's showcase player: a looping run+jump cycle
// centered on a fixed world position, sampled independently by EntityShowcase (visuals)
// and VfxShowcase (motion-triggered dust/footstep juice) so both agree on exactly where
// the player is without one importing the other's internals.
import type { World } from "@dc2d/engine";

const JUMP_PERIOD_MS = 1200;
const JUMP_AIR_MS = 1000;
const JUMP_HEIGHT = 2.5;
const RUN_SPAN_TILES = 3;
const RUN_PERIOD_MS = 2000;

export interface ShowcasePlayerPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly faceX: number;
  readonly air: boolean;
}

function runOffset(nowMs: number): number {
  return (Math.sin((nowMs / RUN_PERIOD_MS) * Math.PI * 2) + 1) * RUN_SPAN_TILES;
}

/** The showcase player's pose at `nowMs`: loops running back and forth, jumping in place, centered on (baseX, baseY). */
export function showcasePlayerPose(world: World, nowMs: number, baseX: number, baseY: number): ShowcasePlayerPose {
  const x = baseX - RUN_SPAN_TILES + runOffset(nowMs);
  const y = baseY;
  const groundHeight = world.groundAt(x, y);
  const jumpPhase = nowMs % JUMP_PERIOD_MS;
  const air = jumpPhase < JUMP_AIR_MS;
  const z = air ? groundHeight + Math.sin((jumpPhase / JUMP_AIR_MS) * Math.PI) * JUMP_HEIGHT : groundHeight;
  const faceX = Math.cos((nowMs / RUN_PERIOD_MS) * Math.PI * 2) >= 0 ? 1 : -1;
  return { x, y, z, faceX, air };
}
