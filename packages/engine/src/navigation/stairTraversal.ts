import { STEP_UP } from "../core/constants.js";
import type { WorldView } from "../world/core/types.js";

const STAIR_RIM_PROBE = 0.01;

/** Match movement's side-rim gate when evaluating a path edge. */
export function stairRimBlocks(
  request: { world: WorldView; from: { x: number; y: number }; to: { x: number; y: number } },
): boolean {
  const { world, from, to } = request;
  const probe = rimProbe(from, to);
  const near = groundAtProbe({ world, from, probe, offset: -STAIR_RIM_PROBE });
  const far = groundAtProbe({ world, from, probe, offset: STAIR_RIM_PROBE });
  return far - near > STEP_UP;
}

interface RimProbe { horizontal: boolean; axisBoundary: number; sign: number; }

function rimProbe(from: { x: number; y: number }, to: { x: number; y: number }): RimProbe {
  const dx = to.x - from.x;
  const horizontal = dx !== 0;
  const sign = Math.sign(horizontal ? dx : to.y - from.y);
  const start = horizontal ? from.x : from.y;
  return { horizontal, sign, axisBoundary: sign > 0 ? start + 1 : start };
}

function groundAtProbe(request: { world: WorldView; from: { x: number; y: number }; probe: RimProbe; offset: number }): number {
  const { world, from, probe, offset } = request;
  const axis = probe.axisBoundary + probe.sign * offset;
  return probe.horizontal ? world.groundAt(axis, from.y + 0.5) : world.groundAt(from.x + 0.5, axis);
}
