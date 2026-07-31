import {
  ADMIN_MAP_MAX_RADIUS,
  TERRAIN,
  type AdminMap,
  type AdminMapEntity,
  type AdminPalette,
  type DebugFlags,
} from "@dc2d/engine";
import { PET_DEFINITIONS } from "../pets/index.js";
import type { SimState } from "../state/state.js";
import { adminMapEntities } from "./map/adminMapEntities.js";

const DEFAULT_RADIUS = 10;
export interface AdminMapRequest {
  readonly x: number;
  readonly y: number;
  readonly radius?: number;
  /** Private active-admin snapshot only; portal maps intentionally omit projectiles. */
  readonly includeProjectileDiagnostics?: boolean;
}

export interface AdminDebugEntityRequest {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly flags: DebugFlags;
}

export function adminMap(sim: SimState, request: AdminMapRequest): AdminMap {
  const radius = clampRadius(request.radius ?? DEFAULT_RADIUS);
  const center = { x: request.x, y: request.y };
  const entities = adminMapEntities(sim, {
    center,
    radius,
    includeProjectiles: request.includeProjectileDiagnostics === true,
  });
  return {
    level: sim.world.level,
    floor: sim.world.floor,
    center,
    radius,
    cells: mapCells(sim, center, radius),
    entities,
  };
}

/** Builds nearby private diagnostics without touching terrain map cells. */
export function adminDebugEntities(
  sim: SimState,
  request: AdminDebugEntityRequest,
): AdminMapEntity[] {
  const radius = clampRadius(request.radius);
  return adminMapEntities(sim, {
    center: { x: request.x, y: request.y },
    radius,
    includeProjectiles: request.flags.attacks,
    flags: request.flags,
    diagnosticsOnly: true,
  });
}

export function adminPalette(sim: SimState): AdminPalette {
  const items = [...sim.content.items.values()];
  return {
    enemies: [...sim.content.enemies.keys()].sort(),
    items: items.filter((item) => !item.weapon).map((item) => item.id).sort(),
    weapons: items.filter((item) => Boolean(item.weapon)).map((item) => item.id).sort(),
    pets: PET_DEFINITIONS.map((definition) => definition.id).sort(),
  };
}

function clampRadius(radius: number): number {
  return Math.max(4, Math.min(ADMIN_MAP_MAX_RADIUS, Math.floor(radius)));
}

function mapCells(sim: SimState, center: { x: number; y: number }, radius: number): AdminMap["cells"] {
  const cells: AdminMap["cells"] = [];
  const originX = Math.floor(center.x);
  const originY = Math.floor(center.y);
  for (let y = originY - radius; y <= originY + radius; y++) {
    for (let x = originX - radius; x <= originX + radius; x++) {
      cells.push({
        x,
        y,
        height: sim.world.heightAt(x, y),
        walkable: sim.world.isWalkable(x + 0.5, y + 0.5),
        terrain: sim.world.terrainAt(x, y) === TERRAIN.Void ? "void" : "floor",
        feature: sim.world.featureAt(x, y),
      });
    }
  }
  return cells;
}
