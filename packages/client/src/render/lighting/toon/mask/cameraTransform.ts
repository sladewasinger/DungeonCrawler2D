/** Camera state that invalidates the cached Toon mask capture. */
export interface ToonCameraTransformSource {
  readonly x: number;
  readonly y: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

export interface ToonCameraTransform extends ToonCameraTransformSource {
  readonly rotation: number;
}

export function toonCameraTransform(
  camera: ToonCameraTransformSource,
  rotation: number,
): ToonCameraTransform {
  return {
    x: camera.x,
    y: camera.y,
    scrollX: camera.scrollX,
    scrollY: camera.scrollY,
    zoom: camera.zoom,
    rotation,
    width: camera.width,
    height: camera.height,
  };
}

export function toonCameraTransformChanged(
  previous: ToonCameraTransform | null,
  camera: ToonCameraTransformSource,
  rotation: number,
): boolean {
  if (!previous) return true;
  const next = toonCameraTransform(camera, rotation);
  return CAMERA_TRANSFORM_FIELDS.some((field) =>
    previous[field] !== next[field]);
}

const CAMERA_TRANSFORM_FIELDS: readonly (keyof ToonCameraTransform)[] = [
  "x",
  "y",
  "scrollX",
  "scrollY",
  "zoom",
  "rotation",
  "width",
  "height",
];
