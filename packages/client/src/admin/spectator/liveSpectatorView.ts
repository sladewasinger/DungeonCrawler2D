import type { AdminMap, AdminMapEntity } from "@dc2d/engine";

export interface LiveSpectatorPoint {
  readonly x: number;
  readonly y: number;
}

export interface LiveSpectatorCanvas {
  readonly width: number;
  readonly height: number;
}

export interface LiveSpectatorView {
  readonly center: LiveSpectatorPoint;
  readonly focus: LiveSpectatorPoint;
  readonly tileSize: number;
  readonly elevation: number;
}

export interface LiveSpectatorViewInput {
  readonly map: AdminMap;
  readonly targetId: string | null;
  readonly canvas: LiveSpectatorCanvas;
}

/**
 * Camera math deliberately belongs to the live spectator surface rather than the
 * inspector map. The inspector is a grid tool; this is a player-following viewport.
 */
export function createLiveSpectatorView(input: LiveSpectatorViewInput): LiveSpectatorView {
  const target = targetEntity(input.map, input.targetId);
  const center = target ? { x: target.x, y: target.y } : input.map.center;
  return {
    center,
    focus: { x: input.canvas.width / 2, y: input.canvas.height * 0.6 },
    tileSize: liveSpectatorTileSize(input.canvas),
    elevation: target?.z ?? elevationAt(input.map, center),
  };
}

export function liveSpectatorPoint(
  view: LiveSpectatorView,
  world: LiveSpectatorPoint,
  elevation = view.elevation,
): LiveSpectatorPoint {
  return {
    x: view.focus.x + (world.x - view.center.x) * view.tileSize,
    y: view.focus.y + (world.y - view.center.y) * view.tileSize -
      (elevation - view.elevation) * view.tileSize,
  };
}

export function liveSpectatorPointIsVisible(
  point: LiveSpectatorPoint,
  canvas: LiveSpectatorCanvas,
  padding: number,
): boolean {
  return point.x >= -padding && point.x <= canvas.width + padding &&
    point.y >= -padding && point.y <= canvas.height + padding;
}

function targetEntity(map: AdminMap, targetId: string | null): AdminMapEntity | undefined {
  return targetId ? map.entities.find((entity) => entity.id === targetId) : undefined;
}

function liveSpectatorTileSize(canvas: LiveSpectatorCanvas): number {
  const visibleTiles = Math.min(canvas.width / 13, canvas.height / 11);
  return Math.max(28, Math.min(44, Math.round(visibleTiles)));
}

function elevationAt(map: AdminMap, point: LiveSpectatorPoint): number {
  const x = Math.floor(point.x);
  const y = Math.floor(point.y);
  return map.cells.find((cell) => cell.x === x && cell.y === y)?.height ?? 0;
}
