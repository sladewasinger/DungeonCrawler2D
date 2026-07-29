import type { AreaDef, ContentRegistry } from "../types.js";
import {
  composeAreaLayer,
  orderedAreaLayers,
  type LayerComposition,
} from "./layers.js";
import type { AreaLayer, AreaPlacement } from "./types.js";

interface AreaLayerPlacement {
  readonly content: ContentRegistry;
  readonly existing: readonly AreaLayer[];
  readonly placement: AreaPlacement;
  readonly def: AreaDef;
}

export function composeAreaPlacement(
  request: AreaLayerPlacement,
): LayerComposition {
  const { content, existing, placement, def } = request;
  const incoming = newAreaLayer(def, placement);
  if (!existing.some((layer) => layer.defId === def.id)) {
    return composeAreaLayer(content, existing, incoming);
  }
  return {
    ok: true,
    layers: orderedAreaLayers(content, [
      ...existing.filter((layer) => layer.defId !== def.id),
      incoming,
    ]),
  };
}

function newAreaLayer(def: AreaDef, placement: AreaPlacement): AreaLayer {
  return {
    defId: def.id,
    remaining: def.duration,
    steps: placement.steps,
    ...(placement.sourceId === undefined ? {} : { sourceId: placement.sourceId }),
  };
}
