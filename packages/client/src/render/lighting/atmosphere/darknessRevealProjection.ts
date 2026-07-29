import { groundToScreen } from "../../entities/geometry/worldToScreen.js";
import type { GroundLightRevealCell } from "../ground/groundLightTypes.js";

export interface DarknessRevealCamera {
  readonly centerX: number;
  readonly centerY: number;
  readonly rotation: number;
  readonly zoom: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface DarknessRevealTextureScale {
  readonly x: number;
  readonly y: number;
}

export interface DarknessRevealStamp {
  readonly x: number;
  readonly y: number;
}

export interface DarknessScreenSpaceTransform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function sameDarknessRevealCamera(
  left: DarknessRevealCamera | null,
  right: DarknessRevealCamera,
): boolean {
  return left !== null &&
    left.centerX === right.centerX &&
    left.centerY === right.centerY &&
    left.rotation === right.rotation &&
    left.zoom === right.zoom &&
    left.viewportWidth === right.viewportWidth &&
    left.viewportHeight === right.viewportHeight;
}

/** Projects an exact source anchor when present; LOS cells intentionally use tile centers. */
export function darknessRevealStamp(
  cell: GroundLightRevealCell,
  camera: DarknessRevealCamera,
  textureScale: DarknessRevealTextureScale,
): DarknessRevealStamp {
  const world = groundToScreen(
    cell.anchorX ?? cell.tileX + 0.5,
    cell.anchorY ?? cell.tileY + 0.5,
    cell.groundHeight,
  );
  const screen = projectWorldPoint(world, camera);
  return {
    x: screen.x / textureScale.x,
    y: screen.y / textureScale.y,
  };
}

/** Counteracts the dungeon camera so the RenderTexture is genuinely viewport-space. */
export function darknessScreenSpaceTransform(
  camera: DarknessRevealCamera,
  textureScale: DarknessRevealTextureScale,
): DarknessScreenSpaceTransform {
  const origin = {
    x: camera.viewportWidth / 2,
    y: camera.viewportHeight / 2,
  };
  const inverseOrigin = rotatePoint(origin, -camera.rotation);
  return {
    x: origin.x - inverseOrigin.x / camera.zoom,
    y: origin.y - inverseOrigin.y / camera.zoom,
    rotation: -camera.rotation,
    scaleX: textureScale.x / camera.zoom,
    scaleY: textureScale.y / camera.zoom,
  };
}

function projectWorldPoint(
  point: Readonly<{ x: number; y: number }>,
  camera: DarknessRevealCamera,
): DarknessRevealStamp {
  const relative = {
    x: point.x - camera.centerX,
    y: point.y - camera.centerY,
  };
  const rotated = rotatePoint(relative, camera.rotation);
  return {
    x: camera.viewportWidth / 2 + rotated.x * camera.zoom,
    y: camera.viewportHeight / 2 + rotated.y * camera.zoom,
  };
}

function rotatePoint(
  point: Readonly<{ x: number; y: number }>,
  angle: number,
): DarknessRevealStamp {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: cosine * point.x - sine * point.y,
    y: sine * point.x + cosine * point.y,
  };
}
