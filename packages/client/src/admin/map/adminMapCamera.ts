import type { AdminMap } from "@dc2d/engine";
import { ADMIN_MAP_DEFAULT_TILE_SIZE } from "./camera/adminMapZoom.js";

export const ADMIN_MAP_TILE_SIZE = ADMIN_MAP_DEFAULT_TILE_SIZE;

export interface AdminMapCenter {
  readonly x: number;
  readonly y: number;
}

export interface AdminMapCanvas {
  readonly width: number;
  readonly height: number;
}

export interface AdminMapScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface AdminMapProjectionInput {
  readonly world: AdminMapCenter;
  readonly center: AdminMapCenter;
  readonly canvas: AdminMapCanvas;
  readonly tileSize?: number;
}

export interface AdminMapPointerInput {
  readonly event: MouseEvent;
  readonly canvas: HTMLCanvasElement;
  readonly center: AdminMapCenter;
  readonly tileSize?: number;
}

export interface AdminMapPointerCanvasInput {
  readonly event: MouseEvent;
  readonly canvas: HTMLCanvasElement;
}

export interface AdminMapPointerPanInput {
  readonly delta: AdminMapScreenPoint;
  readonly canvas: HTMLCanvasElement;
  readonly tileSize?: number;
}

export interface AdminMapPanInput {
  readonly center: AdminMapCenter;
  readonly direction: AdminMapCenter;
  readonly elapsedMs: number;
  readonly tilesPerSecond: number;
}

export interface AdminMapLocation {
  readonly level: AdminMap["level"];
  readonly floor: number;
}

export function adminMapLocationChanged(
  current: AdminMapLocation | null,
  next: AdminMapLocation | null,
): boolean {
  return next !== null &&
    (current === null || current.level !== next.level || current.floor !== next.floor);
}

/** Returns the centre point of the tile containing a world position. */
export function adminMapTileCenter(point: AdminMapCenter): AdminMapCenter {
  return {
    x: Math.floor(point.x) + 0.5,
    y: Math.floor(point.y) + 0.5,
  };
}

export function adminMapScreenPoint(input: AdminMapProjectionInput): AdminMapScreenPoint {
  const tileSize = input.tileSize ?? ADMIN_MAP_TILE_SIZE;
  return {
    x: input.canvas.width / 2 + (input.world.x - input.center.x) * tileSize,
    y: input.canvas.height / 2 + (input.world.y - input.center.y) * tileSize,
  };
}

export function adminMapPointerWorldPoint(
  input: AdminMapPointerInput,
): AdminMapCenter {
  const point = adminMapPointerCanvasPoint(input);
  const tileSize = input.tileSize ?? ADMIN_MAP_TILE_SIZE;
  return {
    x: Math.floor(input.center.x + (point.x - input.canvas.width / 2) / tileSize) + 0.5,
    y: Math.floor(input.center.y + (point.y - input.canvas.height / 2) / tileSize) + 0.5,
  };
}

export function adminMapPointerCanvasPoint(
  input: AdminMapPointerCanvasInput,
): AdminMapScreenPoint {
  return pointerPosition(
    input.event,
    input.canvas.getBoundingClientRect(),
    input.canvas,
  );
}

export function panAdminMapCenter(input: AdminMapPanInput): AdminMapCenter {
  const distance = input.elapsedMs / 1000 * input.tilesPerSecond;
  return {
    x: input.center.x + input.direction.x * distance,
    y: input.center.y + input.direction.y * distance,
  };
}

export function adminMapPointerWorldDelta(
  input: AdminMapPointerPanInput,
): AdminMapCenter {
  const tileSize = input.tileSize ?? ADMIN_MAP_TILE_SIZE;
  const rect = input.canvas.getBoundingClientRect();
  return {
    x: -input.delta.x * input.canvas.width / rect.width / tileSize,
    y: -input.delta.y * input.canvas.height / rect.height / tileSize,
  };
}

export function panAdminMapCenterByDelta(
  center: AdminMapCenter,
  delta: AdminMapCenter,
): AdminMapCenter {
  return { x: center.x + delta.x, y: center.y + delta.y };
}

export function pointIsNearCanvas(
  point: AdminMapScreenPoint,
  canvas: AdminMapCanvas,
  tileSize = ADMIN_MAP_TILE_SIZE,
): boolean {
  return point.x >= -tileSize && point.x <= canvas.width &&
    point.y >= -tileSize && point.y <= canvas.height;
}

function pointerPosition(
  event: MouseEvent,
  rect: DOMRect,
  canvas: AdminMapCanvas,
): AdminMapScreenPoint {
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}
