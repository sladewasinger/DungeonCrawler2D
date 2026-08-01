import terrainRuntimeTuning from "./terrainRuntimeTuning.json" with { type: "json" };

/** Memory-retention limits for the live terrain renderer. */
export const TERRAIN_RUNTIME_TUNING = {
  retention: {
    maxChunkPlans: positiveInteger(
      terrainRuntimeTuning.retention.maxChunkPlans,
      "maxChunkPlans",
    ),
    maxOrientationRoots: minimumInteger(
      terrainRuntimeTuning.retention.maxOrientationRoots,
      2,
      "maxOrientationRoots",
    ),
    maxWorldChunks: positiveInteger(
      terrainRuntimeTuning.retention.maxWorldChunks,
      "maxWorldChunks",
    ),
  },
  cameraPresentation: cameraPresentationTuning(),
} as const;

function cameraPresentationTuning() {
  const camera = terrainRuntimeTuning.cameraPresentation;
  const referenceViewport = {
    width: positiveInteger(camera.referenceViewport.width, "cameraPresentation.referenceViewport.width"),
    height: positiveInteger(camera.referenceViewport.height, "cameraPresentation.referenceViewport.height"),
  };
  const aspectRatios = cameraAspectRatioTuning(camera, referenceViewport);
  return {
    referenceViewport,
    baseZoom: positiveNumber(camera.baseZoom, "cameraPresentation.baseZoom"),
    ...aspectRatios,
    spectator: spectatorZoomTuning(camera),
  };
}

function cameraAspectRatioTuning(
  camera: typeof terrainRuntimeTuning.cameraPresentation,
  reference: { readonly width: number; readonly height: number },
) {
  const minimumAspectRatio = positiveNumber(camera.minimumAspectRatio, "cameraPresentation.minimumAspectRatio");
  const maximumAspectRatio = positiveNumber(camera.maximumAspectRatio, "cameraPresentation.maximumAspectRatio");
  if (minimumAspectRatio >= maximumAspectRatio) {
    throw new Error("Terrain runtime camera presentation aspect range must increase");
  }
  const referenceAspectRatio = reference.width / reference.height;
  if (referenceAspectRatio <= minimumAspectRatio || referenceAspectRatio >= maximumAspectRatio) {
    throw new Error("Terrain runtime reference viewport aspect must be inside the presentation range");
  }
  return { minimumAspectRatio, maximumAspectRatio };
}

function spectatorZoomTuning(camera: typeof terrainRuntimeTuning.cameraPresentation) {
  const minimumZoom = positiveNumber(camera.spectator.minimumZoom, "cameraPresentation.spectator.minimumZoom");
  const maximumZoom = positiveNumber(camera.spectator.maximumZoom, "cameraPresentation.spectator.maximumZoom");
  if (minimumZoom > maximumZoom) {
    throw new Error("Terrain runtime spectator zoom range must increase");
  }
  return {
    minimumZoom,
    maximumZoom,
    zoomStep: positiveNumber(camera.spectator.zoomStep, "cameraPresentation.spectator.zoomStep"),
  };
}

function positiveInteger(value: number, name: string): number {
  return minimumInteger(value, 1, name);
}

function positiveNumber(value: number, name: string): number {
  if (Number.isFinite(value) && value > 0) return value;
  throw new Error(`Terrain runtime ${name} must be a finite number > 0`);
}

function minimumInteger(value: number, minimum: number, name: string): number {
  if (Number.isInteger(value) && value >= minimum) return value;
  throw new Error(`Terrain runtime ${name} must be an integer >= ${minimum}`);
}
