/** Relative camera zoom stops centered at 4x internal scale = 1.0x user zoom. */

export const BASE_CAMERA_ZOOM = 4.0;
export const RELATIVE_ZOOM_STOPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;
export const CAMERA_ZOOM_STOPS = [2.0, 3.0, 4.0, 5.0, 6.0, 8.0] as const;

function nearestStopIndex(internalZoom: number): number {
  let best = 0;
  for (let i = 1; i < CAMERA_ZOOM_STOPS.length; i++) {
    if (Math.abs(CAMERA_ZOOM_STOPS[i]! - internalZoom) < Math.abs(CAMERA_ZOOM_STOPS[best]! - internalZoom)) best = i;
  }
  return best;
}

export function sanitizeCameraZoom(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return BASE_CAMERA_ZOOM;
  return CAMERA_ZOOM_STOPS[nearestStopIndex(raw)]!;
}

export function stepCameraZoom(currentInternalZoom: number, factor: number): number {
  const best = nearestStopIndex(currentInternalZoom);
  const next = Math.max(0, Math.min(CAMERA_ZOOM_STOPS.length - 1, best + (factor > 1 ? 1 : -1)));
  return CAMERA_ZOOM_STOPS[next]!;
}

export function toRelativeZoom(internalZoom: number): number {
  return internalZoom / BASE_CAMERA_ZOOM;
}

export function formatRelativeZoom(internalZoom: number): string {
  const rel = toRelativeZoom(internalZoom);
  const decimals = Number.isInteger(rel * 2) ? 1 : 2;
  return `${rel.toFixed(decimals)}×`;
}
