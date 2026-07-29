import type { AreaReaction } from "../../content/areaReactions.js";
import type { ContentRegistry } from "../../types.js";
import type { AreaLayer } from "../types.js";

export interface AreaReactionMatch {
  readonly byTag: ReadonlyMap<string, AreaLayer>;
  readonly layers: readonly [AreaLayer, AreaLayer];
}

export class AreaReactionLayerFinder {
  first = -1;
  second = -1;
  private tag = "";
  private excludedIndex = -1;

  find(
    content: ContentRegistry,
    layers: readonly AreaLayer[],
    reaction: AreaReaction,
  ): boolean {
    this.tag = reaction.when[0];
    this.excludedIndex = -1;
    this.first = this.findLayerWithTag(content, layers);
    if (this.first === -1) return false;
    this.tag = reaction.when[1];
    this.excludedIndex = this.first;
    this.second = this.findLayerWithTag(content, layers);
    return this.second !== -1;
  }

  private findLayerWithTag(
    content: ContentRegistry,
    layers: readonly AreaLayer[],
  ): number {
    for (let index = 0; index < layers.length; index++) {
      if (index === this.excludedIndex) continue;
      const layer = layers[index];
      if (layer && layerHasAreaTag(content, layer, this.tag)) return index;
    }
    return -1;
  }
}

export function matchAreaReaction(
  content: ContentRegistry,
  layers: readonly AreaLayer[],
  reaction: AreaReaction,
): AreaReactionMatch | null {
  const finder = new AreaReactionLayerFinder();
  if (!finder.find(content, layers, reaction)) {
    return null;
  }
  const first = layers[finder.first];
  const second = layers[finder.second];
  if (!first || !second) return null;
  return {
    byTag: new Map([
      [reaction.when[0], first],
      [reaction.when[1], second],
    ]),
    layers: [first, second],
  };
}

export function layerHasAreaTag(
  content: ContentRegistry,
  layer: AreaLayer,
  tag: string,
): boolean {
  return content.areas.get(layer.defId)?.tags.includes(tag) ?? false;
}
