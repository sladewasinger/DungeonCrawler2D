import { AREA_NEIGHBOR } from "./areaTileTopology.js";

export interface PuddleRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: {
    readonly tl: number;
    readonly tr: number;
    readonly br: number;
    readonly bl: number;
  };
}

export interface ProjectedPuddleTile {
  readonly x: number;
  readonly y: number;
  readonly neighborMask: number;
}

export interface PuddleGeometryInput {
  readonly tile: ProjectedPuddleTile;
  readonly tileSize: number;
  readonly inset: number;
  readonly radius: number;
}

export function puddleRectFor(input: PuddleGeometryInput): PuddleRect {
  const { tile, tileSize, inset, radius } = input;
  const connected = connections(tile.neighborMask);
  const leftInset = connected.west ? 0 : inset;
  const rightInset = connected.east ? 0 : inset;
  const topInset = connected.north ? 0 : inset;
  const bottomInset = connected.south ? 0 : inset;
  return {
    x: tile.x - tileSize / 2 + leftInset,
    y: tile.y - tileSize / 2 + topInset,
    width: tileSize - leftInset - rightInset,
    height: tileSize - topInset - bottomInset,
    radius: cornerRadii(connected, radius),
  };
}

function connections(mask: number) {
  return {
    north: (mask & AREA_NEIGHBOR.north) !== 0,
    east: (mask & AREA_NEIGHBOR.east) !== 0,
    south: (mask & AREA_NEIGHBOR.south) !== 0,
    west: (mask & AREA_NEIGHBOR.west) !== 0,
  };
}

function cornerRadii(
  connected: ReturnType<typeof connections>,
  radius: number,
): PuddleRect["radius"] {
  return {
    tl: exposedCornerRadius(connected.north, connected.west, radius),
    tr: exposedCornerRadius(connected.north, connected.east, radius),
    br: exposedCornerRadius(connected.south, connected.east, radius),
    bl: exposedCornerRadius(connected.south, connected.west, radius),
  };
}

function exposedCornerRadius(
  firstEdgeConnected: boolean,
  secondEdgeConnected: boolean,
  radius: number,
): number {
  return firstEdgeConnected || secondEdgeConnected ? 0 : radius;
}
