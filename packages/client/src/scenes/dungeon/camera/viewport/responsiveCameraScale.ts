/**
 * Converts a physical Phaser viewport into the same approximate world-space view
 * as the reference gameplay frame. The canvas may fill any browser/container size;
 * the camera is centered inside it and black bars absorb unsupported aspect ratios.
 */
import { TERRAIN_RUNTIME_TUNING } from "../../../../render/terrain/terrainRuntimeTuning.js";

export interface GameplayViewport {
  readonly width: number;
  readonly height: number;
}

export interface GameplayCameraViewport extends GameplayViewport {
  readonly x: number;
  readonly y: number;
}

const CAMERA_PRESENTATION = TERRAIN_RUNTIME_TUNING.cameraPresentation;

export const GAMEPLAY_REFERENCE_VIEWPORT: GameplayViewport = CAMERA_PRESENTATION.referenceViewport;

export const GAMEPLAY_BASE_CAMERA_ZOOM = CAMERA_PRESENTATION.baseZoom;

/** Technical safety floor only: tiny canvases may show less world, never more. */
const MINIMUM_VIEWPORT_SCALE = 0.25;

export function responsiveGameplayCameraZoom(
  viewport: GameplayViewport,
  presentationZoom = 1,
  mobile = false,
): number {
  const mobileMultiplier = mobile ? CAMERA_PRESENTATION.mobileZoomMultiplier : 1;
  return GAMEPLAY_BASE_CAMERA_ZOOM * viewportScale(viewport) * presentationZoom * mobileMultiplier;
}

export function viewportScale(viewport: GameplayViewport): number {
  const bounded = boundedGameplayCameraViewport(viewport);
  const widthScale = bounded.width / GAMEPLAY_REFERENCE_VIEWPORT.width;
  const heightScale = bounded.height / GAMEPLAY_REFERENCE_VIEWPORT.height;
  return Math.max(MINIMUM_VIEWPORT_SCALE, Math.min(widthScale, heightScale));
}

/**
 * Keeps ordinary desktop and landscape-mobile aspect ratios visible (4:3–21:9).
 * Wider or taller browser rectangles receive symmetric pillarbox or letterbox bars.
 */
export function boundedGameplayCameraViewport(viewport: GameplayViewport): GameplayCameraViewport {
  const width = positiveDimension(viewport.width);
  const height = positiveDimension(viewport.height);
  const aspectRatio = width / height;
  if (aspectRatio > CAMERA_PRESENTATION.maximumAspectRatio) {
    const boundedWidth = height * CAMERA_PRESENTATION.maximumAspectRatio;
    return { x: (width - boundedWidth) / 2, y: 0, width: boundedWidth, height };
  }
  if (aspectRatio < CAMERA_PRESENTATION.minimumAspectRatio) {
    const boundedHeight = width / CAMERA_PRESENTATION.minimumAspectRatio;
    return { x: 0, y: (height - boundedHeight) / 2, width, height: boundedHeight };
  }
  return { x: 0, y: 0, width, height };
}

function positiveDimension(dimension: number): number {
  return Math.max(1, dimension);
}
