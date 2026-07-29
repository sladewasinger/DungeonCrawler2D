import type { LightSource } from "../core/lightSource.js";
import type { GroundLightRevealCell } from "./groundLightTypes.js";
import { exactLightRevealStyle } from "./groundLightSourceStyle.js";

export function exactSourceAnchors(
  personal: Readonly<LightSource>,
  worldLights: readonly LightSource[],
): GroundLightRevealCell[] {
  return [exactSourceAnchor(personal), ...worldLights.map(exactSourceAnchor)];
}

export function sameExactSourceAnchors(
  current: readonly GroundLightRevealCell[],
  next: readonly GroundLightRevealCell[],
): boolean {
  return current.length === next.length &&
    current.every((cell, index) => sameExactSourceAnchor(cell, next[index]));
}

function exactSourceAnchor(source: Readonly<LightSource>): GroundLightRevealCell {
  const style = exactLightRevealStyle(source);
  return {
    tileX: Math.floor(source.x),
    tileY: Math.floor(source.y),
    strength: 1,
    groundHeight: source.groundHeight ?? 0,
    anchorX: source.x,
    anchorY: source.y,
    ...style,
  };
}

function sameExactSourceAnchor(
  left: GroundLightRevealCell,
  right: GroundLightRevealCell | undefined,
): boolean {
  return right !== undefined && left.anchorX === right.anchorX &&
    left.anchorY === right.anchorY &&
    left.groundHeight === right.groundHeight &&
    left.brushRadiusTiles === right.brushRadiusTiles &&
    left.brushAlpha === right.brushAlpha;
}
