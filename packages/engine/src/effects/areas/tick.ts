import type { ContentRegistry } from "../types.js";
import type { WorldView } from "../../world/core/types.js";
import { AreaReactionConsumptionBuffer } from "./reactions/rates.js";
import {
  pickAreaSpreadAt,
  type AreaSpreadRuntime,
} from "./spread.js";
import type {
  AreaCell,
  AreaLayer,
  AreaPlacement,
} from "./types.js";

export interface AreaTickContext {
  readonly content: ContentRegistry;
  readonly world: WorldView;
  readonly cells: ReadonlyMap<string, AreaCell>;
  readonly place: (placement: AreaPlacement) => void;
  readonly update: (update: AreaTickUpdate) => boolean;
  readonly hasTagAt: (x: number, y: number, tag: string) => boolean;
  readonly scratch?: AreaTickScratch;
}

export interface AreaTickUpdate {
  readonly areaKey: string;
  readonly layers: AreaLayer[];
  readonly publish: boolean;
}

/** Reused by AreaSystem so live ticks do not allocate rate-tracking storage. */
export class AreaTickScratch {
  readonly spreads: AreaPlacement[] = [];
  readonly consumption = new AreaReactionConsumptionBuffer();

  begin(): void {
    this.spreads.length = 0;
  }
}

export function tickAreas(
  context: AreaTickContext,
  dt: number,
  rng: () => number,
): void {
  const scratch = context.scratch ?? new AreaTickScratch();
  scratch.begin();
  const runtime: AreaTickRuntime = {
    context,
    spreads: scratch.spreads,
    consumption: scratch.consumption,
    spread: {
      content: context.content,
      world: context.world,
      dt,
      rng,
      hasTagAt: context.hasTagAt,
      hasAreaAt: (x, y) => context.cells.has(`${x},${y}`),
    },
    dt,
    rng,
  };
  for (const [areaKey, cell] of context.cells) {
    tickCell(runtime, areaKey, cell);
  }
  for (const placement of scratch.spreads) context.place(placement);
}

interface AreaTickRuntime {
  readonly context: AreaTickContext;
  readonly spreads: AreaPlacement[];
  readonly consumption: AreaReactionConsumptionBuffer;
  readonly spread: AreaSpreadRuntime;
  readonly dt: number;
  readonly rng: () => number;
}

function tickCell(
  runtime: AreaTickRuntime,
  areaKey: string,
  cell: AreaCell,
): void {
  runtime.consumption.collect(runtime.context.content, cell.layers, runtime.dt);
  const survivors = decayLayers(runtime, cell.layers);
  const accepted = runtime.context.update({
    areaKey,
    layers: survivors,
    publish: survivors.length !== cell.layers.length,
  });
  if (!accepted) return;
  for (const layer of survivors) collectSpread(runtime, areaKey, layer);
}

function decayLayers(
  runtime: AreaTickRuntime,
  layers: readonly AreaLayer[],
): AreaLayer[] {
  const survivors: AreaLayer[] = [];
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!layer) continue;
    const decayed = decayLayer(
      layer,
      runtime.dt,
      runtime.consumption.amountAt(index),
    );
    if (decayed) survivors.push(decayed);
  }
  return survivors;
}

function decayLayer(
  layer: AreaLayer,
  dt: number,
  reactionConsumption: number,
): AreaLayer | null {
  const remaining = layer.remaining - dt - reactionConsumption;
  return remaining > 0 ? { ...layer, remaining } : null;
}

function collectSpread(
  runtime: AreaTickRuntime,
  areaKey: string,
  layer: AreaLayer,
): void {
  const spread = pickAreaSpreadAt(runtime.spread, areaKey, layer);
  if (spread) runtime.spreads.push(spread);
}
