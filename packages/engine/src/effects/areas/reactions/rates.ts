import type { ContentRegistry } from "../../types.js";
import {
  AreaReactionLayerFinder,
  layerHasAreaTag,
} from "./matching.js";
import type { AreaLayer } from "../types.js";

/**
 * Reusable, index-aligned storage for rate-based lifetime consumption.
 *
 * Area cells have a small, bounded number of compound layers. Reusing this
 * buffer avoids allocating a Map for every live cell on every simulation tick.
 */
export class AreaReactionConsumptionBuffer {
  private readonly amounts: number[] = [];
  private readonly finder = new AreaReactionLayerFinder();
  private content: ContentRegistry | null = null;
  private layers: readonly AreaLayer[] = [];
  private dt = 0;

  reset(layerCount: number): void {
    while (this.amounts.length < layerCount) this.amounts.push(0);
    for (let index = 0; index < layerCount; index++) this.amounts[index] = 0;
  }

  amountAt(index: number): number {
    return this.amounts[index] ?? 0;
  }

  collect(
    content: ContentRegistry,
    layers: readonly AreaLayer[],
    dt: number,
  ): void {
    this.content = content;
    this.layers = layers;
    this.dt = dt;
    this.reset(layers.length);
    for (const reaction of content.areaReactions) {
      this.collectReaction(reaction);
    }
  }

  private collectReaction(
    reaction: ContentRegistry["areaReactions"][number],
  ): void {
    let activeSeconds: number | null = null;
    for (const action of reaction.actions) {
      if (action.op !== "rate_consume") continue;
      if (activeSeconds === null) {
        activeSeconds = this.matchedSeconds(reaction);
      }
      if (activeSeconds === null) return;
      this.addForTag(action.tag, action.perSecond * activeSeconds);
    }
  }

  private matchedSeconds(
    reaction: ContentRegistry["areaReactions"][number],
  ): number | null {
    const { content, layers } = this;
    if (!content || !this.finder.find(content, layers, reaction)) {
      return null;
    }
    const first = layers[this.finder.first];
    const second = layers[this.finder.second];
    if (!first || !second) return null;
    return Math.min(
      this.dt,
      first.remaining,
      second.remaining,
    );
  }

  private addForTag(
    tag: string,
    amount: number,
  ): void {
    const { content, layers } = this;
    if (!content) return;
    for (let index = 0; index < layers.length; index++) {
      const layer = layers[index];
      if (!layer || !layerHasAreaTag(content, layer, tag)) continue;
      this.amounts[index] = (this.amounts[index] ?? 0) + amount;
    }
  }
}

/**
 * Compatibility helper for callers that need a layer-keyed snapshot.
 * The live tick path uses AreaReactionConsumptionBuffer instead.
 */
export function areaReactionConsumption(
  content: ContentRegistry,
  layers: readonly AreaLayer[],
  dt: number,
): ReadonlyMap<AreaLayer, number> {
  const buffer = new AreaReactionConsumptionBuffer();
  buffer.collect(content, layers, dt);
  const consumption = new Map<AreaLayer, number>();
  for (let index = 0; index < layers.length; index++) {
    const amount = buffer.amountAt(index);
    const layer = layers[index];
    if (layer && amount > 0) consumption.set(layer, amount);
  }
  return consumption;
}
