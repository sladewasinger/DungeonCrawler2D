import type { ContentRegistry } from "../types.js";
import type { WorldView } from "../../world/core/types.js";
import type {
  AreaLayer,
  AreaPlacement,
} from "./types.js";

const CARDINAL_OFFSETS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export interface AreaSpreadPlan {
  readonly content: ContentRegistry;
  readonly world: WorldView;
  readonly key: string;
  readonly layer: AreaLayer;
  readonly dt: number;
  readonly rng: () => number;
  readonly hasTagAt: (x: number, y: number, tag: string) => boolean;
  readonly hasAreaAt: (x: number, y: number) => boolean;
}

export interface AreaSpreadRuntime {
  readonly content: ContentRegistry;
  readonly world: WorldView;
  readonly dt: number;
  readonly rng: () => number;
  readonly hasTagAt: (x: number, y: number, tag: string) => boolean;
  readonly hasAreaAt: (x: number, y: number) => boolean;
}

interface AreaSpreadOrigin {
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly buoyancy: number;
  readonly ontoAreaTag: string | undefined;
}

export function pickAreaSpread(
  plan: AreaSpreadPlan,
): AreaPlacement | null {
  return pickAreaSpreadAt({
    content: plan.content,
    world: plan.world,
    dt: plan.dt,
    rng: plan.rng,
    hasTagAt: plan.hasTagAt,
    hasAreaAt: plan.hasAreaAt,
  }, plan.key, plan.layer);
}

/**
 * Allocation-light spread probe for the live area tick. It preserves the
 * existing chance and candidate-selection RNG order.
 */
export function pickAreaSpreadAt(
  runtime: AreaSpreadRuntime,
  key: string,
  layer: AreaLayer,
): AreaPlacement | null {
  const def = runtime.content.areas.get(layer.defId);
  if (!def?.spread || layer.steps >= def.spread.maxSteps) return null;
  if (runtime.rng() >= def.spread.chance * runtime.dt) return null;
  const origin = spreadOrigin(runtime, key, {
    buoyancy: def.buoyancy,
    ontoAreaTag: def.spread.ontoAreaTag,
  });
  return pickSpreadPlacement(runtime, origin, layer);
}

function spreadOrigin(
  runtime: AreaSpreadRuntime,
  key: string,
  properties: Pick<AreaSpreadOrigin, "buoyancy" | "ontoAreaTag">,
): AreaSpreadOrigin {
  const separator = key.indexOf(",");
  const x = Number(key.slice(0, separator));
  const y = Number(key.slice(separator + 1));
  return {
    x,
    y,
    height: runtime.world.heightAt(x, y),
    ...properties,
  };
}

function countSpreadCandidates(
  runtime: AreaSpreadRuntime,
  origin: AreaSpreadOrigin,
): number {
  let count = 0;
  for (const offset of CARDINAL_OFFSETS) {
    if (canSpreadTo(runtime, origin, offset)) count++;
  }
  return count;
}

function pickSpreadPlacement(
  runtime: AreaSpreadRuntime,
  origin: AreaSpreadOrigin,
  layer: AreaLayer,
): AreaPlacement | null {
  const selected = Math.floor(runtime.rng() * countSpreadCandidates(runtime, origin));
  let remaining = selected;
  for (const offset of CARDINAL_OFFSETS) {
    if (!canSpreadTo(runtime, origin, offset)) continue;
    if (remaining === 0) {
      return spreadPlacement(
        layer,
        origin.x + offset[0],
        origin.y + offset[1],
      );
    }
    remaining--;
  }
  return null;
}

function canSpreadTo(
  runtime: AreaSpreadRuntime,
  origin: AreaSpreadOrigin,
  offset: readonly [number, number],
): boolean {
  const x = origin.x + offset[0];
  const y = origin.y + offset[1];
  if (!runtime.world.isWalkable(x, y)) return false;
  if (!isHeightEligible(runtime.world, origin, offset)) return false;
  if (!origin.ontoAreaTag) return !runtime.hasAreaAt(x, y);
  return runtime.hasTagAt(x, y, origin.ontoAreaTag);
}

function spreadPlacement(
  layer: AreaLayer,
  x: number,
  y: number,
): AreaPlacement {
  return {
    defId: layer.defId,
    x,
    y,
    steps: layer.steps + 1,
    ...(layer.sourceId === undefined ? {} : { sourceId: layer.sourceId }),
  };
}

function isHeightEligible(
  world: WorldView,
  origin: AreaSpreadOrigin,
  offset: readonly [number, number],
): boolean {
  const neighborHeight = world.heightAt(
    origin.x + offset[0],
    origin.y + offset[1],
  );
  if (origin.buoyancy === -1) return neighborHeight <= origin.height + 0.01;
  return origin.buoyancy !== 1 || neighborHeight >= origin.height - 0.01;
}
