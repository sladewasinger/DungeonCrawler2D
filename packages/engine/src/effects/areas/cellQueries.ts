import type { ContentRegistry } from "../types.js";
import type {
  AreaCell,
  AreaContact,
  AreaLayer,
} from "./types.js";

export function areaLayerAt(
  cell: AreaCell | undefined,
  defId: string,
): AreaLayer | undefined {
  return cell?.layers.find((layer) => layer.defId === defId);
}

export function areaCellHasTag(
  content: ContentRegistry,
  cell: AreaCell | undefined,
  tag: string,
): boolean {
  return cell?.layers.some((layer) =>
    content.areas.get(layer.defId)?.tags.includes(tag)
  ) ?? false;
}

export function areaCellContacts(
  content: ContentRegistry,
  cell: AreaCell | undefined,
): AreaContact[] {
  if (!cell) return [];
  return cell.layers.flatMap((layer) => contactForLayer(content, layer));
}

function contactForLayer(
  content: ContentRegistry,
  layer: AreaLayer,
): AreaContact[] {
  const statusId = content.areas.get(layer.defId)?.onEnterStatus;
  if (!statusId) return [];
  return [{
    statusId,
    ...(layer.sourceId === undefined ? {} : { sourceId: layer.sourceId }),
  }];
}
