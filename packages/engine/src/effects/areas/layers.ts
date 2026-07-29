import type { AreaDef, ContentRegistry } from "../types.js";
import type { AreaCell, AreaLayer, AreaTileState } from "./types.js";

export const AREA_CHANNELS = ["surface", "flame", "gas"] as const;
export const MAX_AREA_LAYERS = AREA_CHANNELS.length;

const CHANNEL_ORDER: Readonly<Record<AreaDef["channel"], number>> = {
  surface: 0,
  flame: 1,
  gas: 2,
};

export type LayerComposition =
  | { readonly ok: true; readonly layers: AreaLayer[] }
  | {
    readonly ok: false;
    readonly reason: "lower-priority-channel" | "equal-priority-channel";
    readonly channel: AreaDef["channel"];
  };

export function orderedAreaLayers(
  content: ContentRegistry,
  layers: readonly AreaLayer[],
): AreaLayer[] {
  return [...layers].sort((a, b) => compareLayers(content, a, b));
}

export function composeAreaLayer(
  content: ContentRegistry,
  existing: readonly AreaLayer[],
  incoming: AreaLayer,
): LayerComposition {
  const incomingDef = content.areas.get(incoming.defId);
  if (!incomingDef) return { ok: true, layers: [...existing] };
  const conflict = existing.find((layer) =>
    content.areas.get(layer.defId)?.channel === incomingDef.channel
  );
  if (!conflict) {
    return { ok: true, layers: orderedAreaLayers(content, [...existing, incoming]) };
  }
  return resolveChannelConflict({
    content,
    existing,
    incoming,
    conflict,
    incomingDef,
  });
}

interface AreaTileStateRequest {
  readonly content: ContentRegistry;
  readonly x: number;
  readonly y: number;
  readonly cell: AreaCell | undefined;
}

export function areaTileState(request: AreaTileStateRequest): AreaTileState {
  const { content, x, y, cell } = request;
  const layers = cell ? orderedAreaLayers(content, cell.layers) : [];
  const defId = layers.at(-1)?.defId ?? null;
  if (layers.length <= 1) return { x, y, defId };
  return { x, y, defId, layers: layers.map((layer) => layer.defId) };
}

interface ChannelConflict {
  readonly content: ContentRegistry;
  readonly existing: readonly AreaLayer[];
  readonly incoming: AreaLayer;
  readonly conflict: AreaLayer;
  readonly incomingDef: AreaDef;
}

function resolveChannelConflict(request: ChannelConflict): LayerComposition {
  const { content, existing, incoming, conflict, incomingDef } = request;
  const existingPriority = content.areas.get(conflict.defId)?.priority;
  if (existingPriority === undefined || incomingDef.priority > existingPriority) {
    const retained = existing.filter((layer) => layer !== conflict);
    return { ok: true, layers: orderedAreaLayers(content, [...retained, incoming]) };
  }
  const reason = incomingDef.priority === existingPriority
    ? "equal-priority-channel"
    : "lower-priority-channel";
  return { ok: false, reason, channel: incomingDef.channel };
}

function compareLayers(
  content: ContentRegistry,
  a: AreaLayer,
  b: AreaLayer,
): number {
  const aDef = content.areas.get(a.defId);
  const bDef = content.areas.get(b.defId);
  const channelOrder = areaChannelOrder(aDef) - areaChannelOrder(bDef);
  return channelOrder || a.defId.localeCompare(b.defId);
}

function areaChannelOrder(def: AreaDef | undefined): number {
  return def ? CHANNEL_ORDER[def.channel] : Number.MAX_SAFE_INTEGER;
}
