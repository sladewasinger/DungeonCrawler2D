import type { AdminAttackArea, AdminMapEntity } from "@dc2d/engine";

export interface AdminDebugPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AdminDebugCircle {
  readonly center: AdminDebugPoint;
  readonly radius: number;
}

export interface AdminDebugBox {
  readonly center: AdminDebugPoint;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export interface AdminDebugWedge {
  readonly center: AdminDebugPoint;
  readonly direction: { readonly x: number; readonly y: number };
  readonly radius: number;
  readonly arcCos: number;
}

export interface AdminDebugSearch {
  readonly anchor: AdminDebugPoint;
  readonly target?: AdminDebugPoint;
  readonly waypoint?: AdminDebugPoint;
}

export function combatHurtbox(entity: AdminMapEntity): AdminDebugBox | undefined {
  const hurtbox = entity.debug?.hurtbox;
  if (!hurtbox) return undefined;
  return { center: entityPoint(entity), ...hurtbox };
}

export function activeAttackAreas(entity: AdminMapEntity): readonly AdminAttackArea[] {
  return entity.debug?.attacks ?? [];
}

export function attackCircle(
  entity: AdminMapEntity,
  attack: Extract<AdminAttackArea, { readonly shape: "circle" }>,
): AdminDebugCircle {
  return { center: entityPoint(entity), radius: attack.radius };
}

export function attackWedge(
  entity: AdminMapEntity,
  attack: Extract<AdminAttackArea, { readonly shape: "cone" }>,
): AdminDebugWedge {
  return {
    center: entityPoint(entity),
    direction: normalizedDirection(attack.direction),
    radius: attack.range,
    arcCos: attack.arcCos,
  };
}

export function attackTile(
  attack: Extract<AdminAttackArea, { readonly shape: "tile" }>,
): AdminDebugPoint {
  return attack.center;
}

export function activeGuardArea(entity: AdminMapEntity): AdminDebugWedge | undefined {
  const guard = entity.debug?.guard;
  if (!guard) return undefined;
  return {
    center: entityPoint(entity),
    direction: normalizedDirection(guard.direction),
    radius: guard.radius,
    arcCos: guard.arcCos,
  };
}

export function currentLineOfSight(entity: AdminMapEntity): AdminDebugPoint | undefined {
  return entity.debug?.lineOfSight;
}

export function activeSearch(entity: AdminMapEntity): AdminDebugSearch | undefined {
  const search = entity.debug?.search;
  if (!search) return undefined;
  return {
    anchor: search.anchor,
    ...(search.target ? { target: search.target } : {}),
    ...(search.waypoint ? { waypoint: search.waypoint } : {}),
  };
}

export function navigationPath(entity: AdminMapEntity): readonly AdminDebugPoint[] {
  return entity.debug?.navigation?.path ?? [];
}

/** Returns a closed, ground-plane outline for exact cone and guard wedges. */
export function wedgeOutline(
  wedge: AdminDebugWedge,
  segments = 12,
): AdminDebugPoint[] {
  const halfAngle = Math.acos(clampArcCos(wedge.arcCos));
  const baseAngle = Math.atan2(wedge.direction.y, wedge.direction.x);
  const points = [wedge.center];
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = baseAngle - halfAngle + halfAngle * 2 * progress;
    points.push(offsetPoint(wedge.center, wedge.radius, angle));
  }
  points.push(wedge.center);
  return points;
}

export function circleOutline(
  circle: AdminDebugCircle,
  segments = 20,
): AdminDebugPoint[] {
  const points: AdminDebugPoint[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = Math.PI * 2 * index / segments;
    points.push(offsetPoint(circle.center, circle.radius, angle));
  }
  return points;
}

/** Returns the exact closed world-horizontal outline of an axis-aligned hurtbox. */
export function boxOutline(box: AdminDebugBox): AdminDebugPoint[] {
  const { center, halfWidth, halfDepth } = box;
  return [
    { x: center.x - halfWidth, y: center.y - halfDepth, z: center.z },
    { x: center.x + halfWidth, y: center.y - halfDepth, z: center.z },
    { x: center.x + halfWidth, y: center.y + halfDepth, z: center.z },
    { x: center.x - halfWidth, y: center.y + halfDepth, z: center.z },
    { x: center.x - halfWidth, y: center.y - halfDepth, z: center.z },
  ];
}

export function tileOutline(center: AdminDebugPoint): AdminDebugPoint[] {
  const half = 0.5;
  return [
    { x: center.x - half, y: center.y - half, z: center.z },
    { x: center.x + half, y: center.y - half, z: center.z },
    { x: center.x + half, y: center.y + half, z: center.z },
    { x: center.x - half, y: center.y + half, z: center.z },
    { x: center.x - half, y: center.y - half, z: center.z },
  ];
}

export function entityPoint(entity: AdminMapEntity): AdminDebugPoint {
  return { x: entity.x, y: entity.y, z: entity.z };
}

function offsetPoint(
  center: AdminDebugPoint,
  radius: number,
  angle: number,
): AdminDebugPoint {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
    z: center.z,
  };
}

function normalizedDirection(direction: { readonly x: number; readonly y: number }) {
  const length = Math.hypot(direction.x, direction.y);
  if (length <= 0.001) return { x: 1, y: 0 };
  return { x: direction.x / length, y: direction.y / length };
}

function clampArcCos(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
