export const ADMIN_MAP_TILE_SIZE = 24;

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

export interface AdminMapPointerInput {
  readonly event: MouseEvent;
  readonly canvas: HTMLCanvasElement;
  readonly center: AdminMapCenter;
}

export interface AdminMapPointerCanvasInput {
  readonly event: MouseEvent;
  readonly canvas: HTMLCanvasElement;
}

export interface AdminMapPanInput {
  readonly center: AdminMapCenter;
  readonly direction: AdminMapCenter;
  readonly elapsedMs: number;
  readonly tilesPerSecond: number;
}

export interface AdminMapLocation {
  readonly level: "dungeon" | "sandbox";
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

export function adminMapScreenPoint(
  world: AdminMapCenter,
  center: AdminMapCenter,
  canvas: AdminMapCanvas,
): AdminMapScreenPoint {
  return {
    x: canvas.width / 2 + (world.x - center.x) * ADMIN_MAP_TILE_SIZE,
    y: canvas.height / 2 + (world.y - center.y) * ADMIN_MAP_TILE_SIZE,
  };
}

export function adminMapPointerWorldPoint(
  input: AdminMapPointerInput,
): AdminMapCenter {
  const point = adminMapPointerCanvasPoint(input);
  return {
    x: Math.floor(input.center.x + (point.x - input.canvas.width / 2) / ADMIN_MAP_TILE_SIZE) + 0.5,
    y: Math.floor(input.center.y + (point.y - input.canvas.height / 2) / ADMIN_MAP_TILE_SIZE) + 0.5,
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

export function pointIsNearCanvas(
  point: AdminMapScreenPoint,
  canvas: AdminMapCanvas,
): boolean {
  return point.x >= -ADMIN_MAP_TILE_SIZE && point.x <= canvas.width &&
    point.y >= -ADMIN_MAP_TILE_SIZE && point.y <= canvas.height;
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
