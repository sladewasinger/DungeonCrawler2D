// Owns the narrow desktop-pointer reconciliation for elevated ordinary spits.
// This stays pure so rendered-center selection can be tested independently from
// Phaser, network wiring, and the server's authoritative reflection predicates.
import { PROJECTILE_CONTACT_RADIUS } from "@dc2d/engine";
import type {
  ProjectileReflectionAim,
  ProjectileReflectionQueryInput,
} from "../../../input/controls/state.js";
import {
  viewToWorld,
  worldToView,
  type Point,
  type ViewOrientation,
} from "../../../render/view/index.js";

export interface ReflectionProjectileSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly defId?: string;
}

export interface ProjectileReflectionSelectionInput extends ProjectileReflectionQueryInput {
  readonly player: Point;
  readonly weaponReach: number;
  readonly projectiles: readonly ReflectionProjectileSnapshot[];
}

const POINTER_SELECTION_RADIUS_TILES = 0.35;

export function findProjectileReflectionAim(
  input: ProjectileReflectionSelectionInput,
): ProjectileReflectionAim | undefined {
  const candidate = nearestPointerProjectile(input);
  if (!candidate) return undefined;
  return {
    projectileId: candidate.projectile.id,
    networkDirection: directionToProjectile(input.player, candidate.projectile),
    presentationDirection: visiblePointerDirection(input),
  };
}

interface PointerProjectileCandidate {
  readonly projectile: ReflectionProjectileSnapshot;
  readonly pointerDistance: number;
}

function nearestPointerProjectile(
  input: ProjectileReflectionSelectionInput,
): PointerProjectileCandidate | undefined {
  let best: PointerProjectileCandidate | undefined;
  for (const projectile of input.projectiles) {
    const candidate = selectableCandidate(input, projectile);
    if (!candidate) continue;
    if (!best || isCloserCandidate(candidate.pointerDistance, projectile.id, best)) best = candidate;
  }
  return best;
}

function selectableCandidate(
  input: ProjectileReflectionSelectionInput,
  projectile: ReflectionProjectileSnapshot,
): PointerProjectileCandidate | undefined {
  if (!isOrdinaryProjectile(projectile)) return undefined;
  if (!withinWeaponReach(input.player, projectile, input.weaponReach)) return undefined;
  const pointerDistance = distanceToRenderedCenter(input, projectile);
  if (pointerDistance > POINTER_SELECTION_RADIUS_TILES) return undefined;
  return { projectile, pointerDistance };
}

function isOrdinaryProjectile(projectile: ReflectionProjectileSnapshot): boolean {
  return projectile.defId === undefined;
}

function withinWeaponReach(
  player: Point,
  projectile: ReflectionProjectileSnapshot,
  weaponReach: number,
): boolean {
  return Math.hypot(projectile.x - player.x, projectile.y - player.y) <=
    weaponReach + PROJECTILE_CONTACT_RADIUS;
}

function distanceToRenderedCenter(
  input: ProjectileReflectionSelectionInput,
  projectile: ReflectionProjectileSnapshot,
): number {
  const center = renderedCenter(projectile, input.orientation);
  return Math.hypot(
    center.x - input.pointerView.x,
    center.y - input.pointerView.y,
  );
}

function renderedCenter(
  projectile: ReflectionProjectileSnapshot,
  orientation: ViewOrientation,
): Point {
  const view = worldToView(projectile, orientation);
  return { x: view.x, y: view.y - projectile.z };
}

function isCloserCandidate(
  pointerDistance: number,
  projectileId: string,
  best: PointerProjectileCandidate,
): boolean {
  return pointerDistance < best.pointerDistance ||
    (pointerDistance === best.pointerDistance && projectileId < best.projectile.id);
}

function directionToProjectile(
  player: Point,
  projectile: ReflectionProjectileSnapshot,
): Point {
  return { x: projectile.x - player.x, y: projectile.y - player.y };
}

function visiblePointerDirection(
  input: ProjectileReflectionSelectionInput,
): Point {
  const pointerWorld = viewToWorld(input.pointerView, input.orientation);
  return {
    x: pointerWorld.x - input.player.x,
    y: pointerWorld.y - input.player.y,
  };
}
