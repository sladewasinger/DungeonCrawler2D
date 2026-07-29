import { hashSeed } from "../../../render/lighting/core/lightSource.js";
import { AREA_LIGHT_STYLES } from "../presentation/areaVisualStyle.js";
import type { FireFieldComponent } from "./fireFieldTopology.js";

const FULL_CIRCLE = Math.PI * 2;

export interface MutableFireFieldLight {
  color: number;
  groundHeight?: number;
  id: string;
  kind: "fire";
  radiusTiles: number;
  seed: number;
  x: number;
  y: number;
}

export function createFireFieldLight(): MutableFireFieldLight {
  return {
    id: "",
    x: 0,
    y: 0,
    color: AREA_LIGHT_STYLES.fire.color,
    radiusTiles: AREA_LIGHT_STYLES.fire.radiusTiles,
    kind: "fire",
    seed: 0,
  };
}

export function initializeFireFieldLight(
  light: MutableFireFieldLight,
  id: string,
): number {
  light.id = id;
  light.seed = hashSeed(id);
  return (light.seed / 0xffffffff) * FULL_CIRCLE;
}

export function placeFireFieldLight(
  light: MutableFireFieldLight,
  component: FireFieldComponent,
): void {
  const firstTile = component.tiles[0];
  if (!firstTile) throw new Error("fire field light requires a component tile");
  const count = component.tiles.length;
  let x = 0;
  let y = 0;
  for (const tile of component.tiles) {
    x += tile.x;
    y += tile.y;
  }
  light.x = x / count;
  light.y = y / count;
  light.groundHeight = firstTile.groundHeight;
}
