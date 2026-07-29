import type { ContentRegistry } from "../types.js";
import type {
  AreaCell,
  AreaIgnition,
  AreaPlacement,
  AreaPlacementResult,
} from "./types.js";

interface FuelIgnitionRequest {
  readonly content: ContentRegistry;
  readonly cell: AreaCell | undefined;
  readonly ignition: AreaIgnition;
  readonly hasFire: boolean;
  readonly place: (placement: AreaPlacement) => AreaPlacementResult;
}

export function igniteAreaFuel(request: FuelIgnitionRequest): boolean {
  const { content, cell, ignition, hasFire, place } = request;
  const fuelTag = ignition.fuelTag ?? "flammable";
  const fuel = cell?.layers.find((layer) =>
    content.areas.get(layer.defId)?.tags.includes(fuelTag)
  );
  if (!fuel || hasFire) return false;
  if (!content.areas.get(ignition.fireDefId)?.tags.includes("fire")) return false;
  return place({
    defId: ignition.fireDefId,
    x: ignition.x,
    y: ignition.y,
    steps: fuel.steps,
    ...(ignition.sourceId === undefined
      ? {}
      : { sourceId: ignition.sourceId }),
  }).applied;
}
