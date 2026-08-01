import { TERRAIN_RUNTIME_TUNING } from "../../render/terrain/terrainRuntimeTuning.js";

export type SpectatorCameraZoomDirection = "in" | "out";

export function nextSpectatorCameraZoom(
  zoom: number,
  direction: SpectatorCameraZoomDirection,
): number {
  const { minimumZoom, maximumZoom, zoomStep } = TERRAIN_RUNTIME_TUNING.cameraPresentation.spectator;
  const change = direction === "in"
    ? zoomStep
    : -zoomStep;
  return Math.max(
    minimumZoom,
    Math.min(maximumZoom, zoom + change),
  );
}
