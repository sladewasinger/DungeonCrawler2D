import {
  createBody,
  launchVelocity,
  makeEntity,
  newEntityId,
  type EffectEvent,
  type Entity,
} from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { applyEntityStatus } from "../../progression/statusApplication.js";
import { ELEMENTAL_ENEMY_TUNING } from "./configuration/elementalEnemyTuning.js";
import {
  captureOilLobBoundarySource,
  oilCellIsReachable,
  oilSourceFor,
  type OilLobBoundarySource,
} from "./oilBoundary.js";
import { oilFootprintCells } from "./oilFootprint.js";

const OIL_LOB_TAG = "enemy-oil-lob";
const OIL_LOB_VISUAL_ID = "pitchbloom-oil-lob";

export interface OilLobLaunch {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly target: { readonly x: number; readonly y: number };
}

export interface OilLobImpact {
  readonly sim: SimState;
  readonly projectile: Entity;
  readonly point: { readonly x: number; readonly y: number };
  readonly directHit: Entity | null;
  readonly effectEvents: EffectEvent[];
}

interface OilLobProjectile extends Entity {
  readonly oilLobBoundarySource: OilLobBoundarySource;
}

export function launchOilLob(input: OilLobLaunch): Entity {
  const { sim, enemy } = input;
  const from = {
    x: enemy.entity.body.x,
    y: enemy.entity.body.y,
    z: enemy.entity.body.z + 0.5,
  };
  const target = oilLobTarget(input);
  const projectile: OilLobProjectile = {
    ...makeEntity("projectile", createBody(from.x, from.y, from.z), {
      id: newEntityId("j"),
      defId: OIL_LOB_VISUAL_ID,
      ownerId: enemy.entity.id,
      tags: new Set([OIL_LOB_TAG, "oil", ...enemy.def.tags]),
      vel: launchVelocity(
        from,
        target,
        ELEMENTAL_ENEMY_TUNING.oilLob.projectileSpeedTilesPerSecond,
      ),
    }),
    oilLobBoundarySource: captureOilLobBoundarySource(enemy),
  };
  sim.projectiles.set(projectile.id, projectile);
  return projectile;
}

function oilLobTarget(input: OilLobLaunch): { x: number; y: number; z: number } {
  const { sim, target } = input;
  const error = ELEMENTAL_ENEMY_TUNING.oilLob.targetingErrorTiles;
  const angle = sim.rng.next() * Math.PI * 2;
  const radius = Math.sqrt(sim.rng.next()) * error;
  const x = target.x + Math.cos(angle) * radius;
  const y = target.y + Math.sin(angle) * radius;
  return { x, y, z: sim.world.groundAt(x, y) };
}

export function isOilLob(projectile: Entity): boolean {
  return projectile.tags.has(OIL_LOB_TAG);
}

export function resolveOilLobImpact(input: OilLobImpact): void {
  if (input.directHit) applyDirectOil(input);
  const source = oilSourceFor(
    input.sim,
    input.projectile.ownerId,
    oilLobBoundarySource(input.projectile),
  );
  if (!source) return;
  placeOilFootprint({ ...input, source });
}

function applyDirectOil(input: OilLobImpact): void {
  const { sim, projectile, directHit, effectEvents } = input;
  if (!directHit) return;
  applyEntityStatus({
    sim,
    entity: directHit,
    statusId: ELEMENTAL_ENEMY_TUNING.oilLob.statusId,
    effectEvents,
    ...(projectile.ownerId === undefined
      ? {}
      : { sourceId: projectile.ownerId }),
  });
}

interface OilFootprintPlacement extends OilLobImpact {
  readonly source: OilLobBoundarySource;
}

function placeOilFootprint(input: OilFootprintPlacement): void {
  const { sim, projectile, point, source } = input;
  const size = ELEMENTAL_ENEMY_TUNING.oilLob.footprintSizeTiles;
  for (const cell of oilFootprintCells(point, size)) {
    placeOilCell({ sim, projectile, source, cell });
  }
}

interface OilCellPlacement {
  readonly sim: SimState;
  readonly projectile: Entity;
  readonly source: OilLobBoundarySource;
  readonly cell: { readonly x: number; readonly y: number };
}

function oilLobBoundarySource(
  projectile: Entity,
): OilLobBoundarySource | undefined {
  return (projectile as Partial<OilLobProjectile>).oilLobBoundarySource;
}

function placeOilCell(input: OilCellPlacement): void {
  const { sim, projectile, source, cell } = input;
  if (!oilCellIsReachable(sim, source, cell)) return;
  sim.areas.place({
    defId: ELEMENTAL_ENEMY_TUNING.oilLob.areaId,
    x: cell.x,
    y: cell.y,
    steps: 0,
    ...(projectile.ownerId === undefined
      ? {}
      : { sourceId: projectile.ownerId }),
  });
}
