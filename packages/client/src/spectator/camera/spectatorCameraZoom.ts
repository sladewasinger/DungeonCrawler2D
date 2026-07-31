const SPECTATOR_CAMERA_MIN_ZOOM = 0.5;
const SPECTATOR_CAMERA_MAX_ZOOM = 2.5;
const SPECTATOR_CAMERA_ZOOM_STEP = 0.25;

export type SpectatorCameraZoomDirection = "in" | "out";

export function nextSpectatorCameraZoom(
  zoom: number,
  direction: SpectatorCameraZoomDirection,
): number {
  const change = direction === "in"
    ? SPECTATOR_CAMERA_ZOOM_STEP
    : -SPECTATOR_CAMERA_ZOOM_STEP;
  return Math.max(
    SPECTATOR_CAMERA_MIN_ZOOM,
    Math.min(SPECTATOR_CAMERA_MAX_ZOOM, zoom + change),
  );
}
