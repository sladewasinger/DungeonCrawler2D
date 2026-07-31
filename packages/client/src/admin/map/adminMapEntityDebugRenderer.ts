import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import {
  activeHitboxes,
  activeGuardArea,
  activeSearch,
  hitboxCircle,
  hitboxTile,
  hitboxWedge,
  boxOutline,
  circleOutline,
  combatHurtbox,
  currentLineOfSight,
  navigationPath,
  tileOutline,
  wedgeOutline,
  type AdminDebugPoint,
} from "../../render/debug/adminDebugGeometry.js";
import {
  movementCollision,
  movementCollisionOutline,
} from "../../render/debug/adminDebugMovementGeometry.js";
import { adminMapEntityScreenPoint } from "./adminMapEntityHitTest.js";
import type { AdminMapCenter } from "./adminMapCamera.js";

export interface AdminMapEntityDebugRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly entity: AdminMapEntity;
  readonly point: AdminMapEntityPoint;
  readonly center: AdminMapCenter;
  readonly debugFlags: DebugFlags;
  readonly tileSize: number;
}

export interface AdminMapEntityPoint {
  readonly x: number;
  readonly y: number;
}

export function drawAdminMapEntityDebug(input: AdminMapEntityDebugRenderInput): void {
  drawAdminMapCombatDebug(input);
  drawAdminMapAwarenessDebug(input);
}

function drawAdminMapCombatDebug(input: AdminMapEntityDebugRenderInput): void {
  if (input.debugFlags.hurtboxes) drawHurtbox(input);
  if (input.debugFlags.movementCollision) drawMovementCollision(input);
  if (input.debugFlags.attacks) drawHitboxes(input);
  if (input.debugFlags.guards) drawGuard(input);
}

function drawAdminMapAwarenessDebug(input: AdminMapEntityDebugRenderInput): void {
  if (input.debugFlags.lineOfSight) drawLineOfSight(input);
  if (input.debugFlags.search) drawSearch(input);
  if (input.debugFlags.navigation) drawNavigation(input);
  if (input.debugFlags.behavior) drawBehavior(input);
}

function drawHurtbox(input: AdminMapEntityDebugRenderInput): void {
  const hurtbox = combatHurtbox(input.entity);
  if (hurtbox) drawAdminMapLine({ ...input, points: boxOutline(hurtbox), color: "#f7c55c", width: 2 });
}

function drawMovementCollision(input: AdminMapEntityDebugRenderInput): void {
  const collision = movementCollision(input.entity);
  if (!collision) return;
  drawAdminMapLine({
    ...input,
    points: movementCollisionOutline(collision),
    color: "#39d5ff",
    width: 2,
  });
}

function drawHitboxes(input: AdminMapEntityDebugRenderInput): void {
  for (const hitbox of activeHitboxes(input.entity)) drawHitbox(input, hitbox);
}

function drawHitbox(
  input: AdminMapEntityDebugRenderInput,
  hitbox: ReturnType<typeof activeHitboxes>[number],
): void {
  if (hitbox.shape === "circle") {
    drawAdminMapLine({ ...input, points: circleOutline(hitboxCircle(input.entity, hitbox)), color: "#f3727d", width: 2 });
    return;
  }
  if (hitbox.shape === "cone") {
    drawAdminMapLine({ ...input, points: wedgeOutline(hitboxWedge(input.entity, hitbox)), color: "#f3727d", width: 2 });
    return;
  }
  drawAdminMapLine({ ...input, points: tileOutline(hitboxTile(hitbox)), color: "#f3727d", width: 2 });
}

function drawGuard(input: AdminMapEntityDebugRenderInput): void {
  const guard = activeGuardArea(input.entity);
  if (guard) drawAdminMapLine({ ...input, points: wedgeOutline(guard), color: "#6cc9ff", width: 2 });
}

function drawLineOfSight(input: AdminMapEntityDebugRenderInput): void {
  const target = currentLineOfSight(input.entity);
  if (target) drawAdminMapLine({ ...input, points: [input.entity, target], color: "#e9c46a", dash: [3, 3] });
}

function drawSearch(input: AdminMapEntityDebugRenderInput): void {
  const search = activeSearch(input.entity);
  if (!search) return;
  drawWorldMarker(input, search.anchor, "#c48df2");
  if (search.target) drawAdminMapLine({ ...input, points: [search.anchor, search.target], color: "#c48df2", dash: [3, 3] });
  if (search.waypoint) drawAdminMapLine({ ...input, points: [input.entity, search.waypoint], color: "#c48df2", dash: [3, 3] });
}

function drawNavigation(input: AdminMapEntityDebugRenderInput): void {
  const path = navigationPath(input.entity);
  if (path.length > 0) drawAdminMapLine({ ...input, points: [input.entity, ...path], color: "#76d7ea", dash: [4, 2] });
}

function drawWorldMarker(
  input: AdminMapEntityDebugRenderInput,
  point: AdminDebugPoint,
  color: string,
): void {
  const size = 0.18;
  drawAdminMapLine({ ...input, points: [{ x: point.x - size, y: point.y, z: point.z }, { x: point.x + size, y: point.y, z: point.z }], color });
  drawAdminMapLine({ ...input, points: [{ x: point.x, y: point.y - size, z: point.z }, { x: point.x, y: point.y + size, z: point.z }], color });
}

interface AdminMapDebugLineInput {
  readonly context: CanvasRenderingContext2D;
  readonly center: AdminMapCenter;
  readonly points: readonly AdminDebugPoint[];
  readonly color: string;
  readonly width?: number;
  readonly dash?: readonly number[];
  readonly tileSize: number;
}

function drawAdminMapLine(input: AdminMapDebugLineInput): void {
  if (input.points.length < 2) return;
  const first = canvasPoint(input, input.points[0]!);
  input.context.strokeStyle = input.color;
  input.context.lineWidth = input.width ?? 1;
  input.context.setLineDash([...(input.dash ?? [])]);
  input.context.beginPath();
  input.context.moveTo(first.x, first.y);
  for (const point of input.points.slice(1)) {
    const screen = canvasPoint(input, point);
    input.context.lineTo(screen.x, screen.y);
  }
  input.context.stroke();
  input.context.setLineDash([]);
}

function canvasPoint(input: AdminMapDebugLineInput, point: AdminDebugPoint): AdminMapEntityPoint {
  return adminMapEntityScreenPoint({
    world: point,
    center: input.center,
    canvas: input.context.canvas,
    tileSize: input.tileSize,
  });
}

function drawBehavior(input: AdminMapEntityDebugRenderInput): void {
  const behavior = input.entity.debug?.behavior;
  if (!behavior) return;
  input.context.fillStyle = behavior === "searching" ? "#f0c36a" : "#b5c5de";
  input.context.font = "9px system-ui";
  input.context.fillText(behavior, input.point.x + 8, input.point.y - 8);
}
