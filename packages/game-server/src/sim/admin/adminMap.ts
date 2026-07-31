import {
  TERRAIN,
  type AdminMap,
  type AdminMapEntity,
  type AdminPalette,
} from "@dc2d/engine";
import type { SimState } from "../state/state.js";
import { adminMapDebugFields } from "./adminMapDebug.js";

const DEFAULT_RADIUS = 10;
const MAX_MAP_ENTITIES = 2048;

export interface AdminMapRequest {
  readonly x: number;
  readonly y: number;
  readonly radius?: number;
}

export function adminMap(sim: SimState, request: AdminMapRequest): AdminMap {
  const radius = clampRadius(request.radius ?? DEFAULT_RADIUS);
  const center = { x: request.x, y: request.y };
  const entities = mapEntities(sim, center, radius);
  return {
    level: sim.world.level,
    floor: sim.world.floor,
    center,
    radius,
    cells: mapCells(sim, center, radius),
    entities: entities.slice(0, MAX_MAP_ENTITIES),
  };
}

export function adminPalette(sim: SimState): AdminPalette {
  const items = [...sim.content.items.values()];
  return {
    enemies: [...sim.content.enemies.keys()].sort(),
    items: items.filter((item) => !item.weapon).map((item) => item.id).sort(),
    weapons: items.filter((item) => Boolean(item.weapon)).map((item) => item.id).sort(),
  };
}

function clampRadius(radius: number): number {
  return Math.max(4, Math.min(16, Math.floor(radius)));
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

function mapEntities(sim: SimState, center: { x: number; y: number }, radius: number): AdminMapEntity[] {
  const entities = [
    ...[...sim.players.values()].filter((slot) => slot.connected).map((slot) => slot.entity),
    ...[...sim.enemies.values()].map((slot) => slot.entity),
    ...[...sim.items.values()],
    ...[...sim.torches.values()],
  ];
  return entities
    .filter((entity) => withinRadius({ x: entity.body.x, y: entity.body.y }, center, radius + 1))
    .map((entity) => mapEntity({ sim, entity }));
}

interface MapEntityInput {
  readonly sim: SimState;
  readonly entity: AdminMapEntitySource;
}

function mapEntity({ sim, entity }: MapEntityInput): AdminMapEntity {
  return {
    id: entity.id,
    kind: entityKind(sim, entity),
    ...(entity.defId ? { defId: entity.defId } : {}),
    ...(entity.name ? { name: entity.name } : {}),
    x: entity.body.x,
    y: entity.body.y,
    z: entity.body.z,
    ...adminMapDebugFields({ sim, entity }),
  };
}

function entityKind(sim: SimState, entity: AdminMapEntitySource): AdminMapEntity["kind"] {
  if (entity.kind === "player" || entity.kind === "enemy") return entity.kind;
  if (entity.kind === "torch") return "torch";
  return entity.defId && sim.content.items.get(entity.defId)?.weapon ? "weapon" : "item";
}

function withinRadius(
  point: { x: number; y: number },
  center: { x: number; y: number },
  radius: number,
): boolean {
  return Math.abs(point.x - center.x) <= radius && Math.abs(point.y - center.y) <= radius;
}

type AdminMapEntitySource = Pick<
  import("@dc2d/engine").Entity,
  "id" | "kind" | "defId" | "name" | "body" | "facing"
>;
