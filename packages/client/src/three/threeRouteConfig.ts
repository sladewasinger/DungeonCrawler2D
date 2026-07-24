/** Defines and parses the renderer-neutral route inputs consumed by ThreeDungeonClient. */
import type { Connection } from "../net/connection.js";
import { DEFAULT_TERRAIN_VIEW_RADIUS } from "./ThreeTerrain.js";
import {
  isViewDistance,
  type ViewDistance,
} from "./viewDistance.js";

export interface ThreeRouteOptions {
  conn: Connection;
  root: HTMLElement;
  search: URLSearchParams;
  onQuitToTitle: () => void;
}

export const queryRouteNumber = (
  search: URLSearchParams,
  key: string,
  fallback: number,
): number => {
  const value = Number(search.get(key));
  return Number.isFinite(value) ? value : fallback;
};

export const queryViewDistance = (
  search: URLSearchParams,
): ViewDistance => {
  const value = queryRouteNumber(
    search,
    "viewDistance",
    DEFAULT_TERRAIN_VIEW_RADIUS,
  );
  return isViewDistance(value) ? value : DEFAULT_TERRAIN_VIEW_RADIUS;
};
