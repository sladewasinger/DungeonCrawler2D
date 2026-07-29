import { WALL_RISE } from "../../../../core/constants.js";
import type { BedrockBridgeTerrain } from "./bedrockEscapeBridge.js";

const HEIGHT_EPSILON = 0.01;

interface BridgePlan {
  readonly terrain: BedrockBridgeTerrain;
  readonly pocket: number;
  readonly path: readonly number[];
  readonly exit: number;
}

export function reconstructBedrockPath(
  predecessor: Int32Array,
  end: number,
): number[] {
  const reversed: number[] = [];
  for (let current = end; current >= 0; current = predecessor[current] ?? -1) {
    reversed.push(current);
  }
  return reversed.reverse();
}

export function planBedrockBridgeHeights(
  plan: BridgePlan,
): number[] | null {
  const { terrain, pocket, path, exit } = plan;
  const exitHeight = terrain.height[exit] ?? 0;
  let previous = terrain.height[pocket] ?? 0;
  const heights: number[] = [];
  for (const cell of path) {
    previous = Math.min(
      terrain.height[cell] ?? previous,
      exitHeight,
      previous + WALL_RISE,
    );
    heights.push(previous);
  }
  return exitHeight - previous <= WALL_RISE + HEIGHT_EPSILON
    ? heights
    : null;
}
