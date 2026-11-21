import { hash2D } from "../../../../core/rng.js";
import type { FloorBounds, FloorPoint } from "../../finiteFloorTypes.js";

interface BridgeRouteInput {
  readonly bounds: FloorBounds;
  readonly seed: number;
  readonly width: number;
  readonly bridge: { readonly endpoints: readonly [FloorPoint, FloorPoint] };
}

export function bridgeRoutes(input: BridgeRouteInput): readonly (readonly FloorPoint[])[] {
  const [from, to] = input.bridge.endpoints;
  const minX = input.bounds.minX + input.width;
  const maxX = input.bounds.maxX - input.width;
  const minY = input.bounds.minY + input.width;
  const maxY = input.bounds.maxY - input.width;
  const direct = hash2D(input.seed, from.x + to.x, from.y + to.y) % 2 === 0
    ? [[from, { x: to.x, y: from.y }, to], [from, { x: from.x, y: to.y }, to]]
    : [[from, { x: from.x, y: to.y }, to], [from, { x: to.x, y: from.y }, to]];
  return [...direct, [from, { x: minX, y: from.y }, { x: minX, y: to.y }, to], [from, { x: maxX, y: from.y }, { x: maxX, y: to.y }, to], [from, { x: from.x, y: minY }, { x: to.x, y: minY }, to], [from, { x: from.x, y: maxY }, { x: to.x, y: maxY }, to]];
}
