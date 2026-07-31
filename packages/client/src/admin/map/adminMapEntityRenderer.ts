import type {
  AdminMap,
  AdminMapEntity,
  DebugFlags,
} from "@dc2d/engine";
import {
  pointIsNearCanvas,
  type AdminMapCenter,
} from "./adminMapCamera.js";
import { adminMapEntityScreenPoint } from "./adminMapEntityHitTest.js";

export interface AdminMapEntityRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
  readonly debugFlags: DebugFlags;
}

interface AdminMapEntityPoint {
  readonly x: number;
  readonly y: number;
}

interface EntityDebugInput {
  readonly context: CanvasRenderingContext2D;
  readonly entity: AdminMapEntity;
  readonly point: AdminMapEntityPoint;
  readonly center: AdminMapCenter;
  readonly debugFlags: DebugFlags;
}

export function drawAdminMapEntities(input: AdminMapEntityRenderInput): void {
  for (const entity of input.map.entities) drawEntity(input, entity);
}

function drawEntity(input: AdminMapEntityRenderInput, entity: AdminMapEntity): void {
  const point = entityPoint(input, entity);
  if (!pointIsNearCanvas(point, input.context.canvas)) return;
  drawEntityDot(input.context, entity, point);
  drawEntityDebug({ ...input, entity, point });
}

function entityPoint(
  input: AdminMapEntityRenderInput,
  entity: AdminMapEntity,
): AdminMapEntityPoint {
  return adminMapEntityScreenPoint(entity, input.center, input.context.canvas);
}

function drawEntityDot(
  context: CanvasRenderingContext2D,
  entity: AdminMapEntity,
  point: AdminMapEntityPoint,
): void {
  context.fillStyle = entityColor(entity.kind);
  context.beginPath();
  context.arc(point.x, point.y, entity.kind === "player" ? 7 : 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e9edf5";
  context.font = "10px system-ui";
  context.fillText(entity.name ?? entity.defId ?? entity.kind, point.x + 8, point.y + 3);
}

function drawEntityDebug(input: EntityDebugInput): void {
  if (input.debugFlags.hurtboxes) drawHurtbox(input);
  if (input.debugFlags.attacks) drawFacing(input, "#f3727d");
  if (input.debugFlags.guards && input.entity.blocking) drawGuard(input);
  drawTargetDebug(input);
  if (input.debugFlags.behavior || input.debugFlags.search) drawBehavior(input);
}

function drawHurtbox(input: EntityDebugInput): void {
  input.context.strokeStyle = input.entity.kind === "player" ? "#74e4f5" : "#ff6b73";
  input.context.beginPath();
  input.context.arc(input.point.x, input.point.y, input.entity.kind === "player" ? 5 : 8, 0, Math.PI * 2);
  input.context.stroke();
}

function drawFacing(input: EntityDebugInput, color: string): void {
  if (!input.entity.facing) return;
  input.context.strokeStyle = color;
  input.context.beginPath();
  input.context.moveTo(input.point.x, input.point.y);
  input.context.lineTo(
    input.point.x + input.entity.facing.x * 14,
    input.point.y + input.entity.facing.y * 14,
  );
  input.context.stroke();
}

function drawGuard(input: EntityDebugInput): void {
  const angle = Math.atan2(input.entity.facing?.y ?? 1, input.entity.facing?.x ?? 0);
  input.context.strokeStyle = "#6cc9ff";
  input.context.beginPath();
  input.context.arc(input.point.x, input.point.y, 14, angle - Math.PI / 3, angle + Math.PI / 3);
  input.context.stroke();
}

function drawTargetDebug(input: EntityDebugInput): void {
  const debug = input.entity.debug;
  if (input.debugFlags.lineOfSight && debug?.target) drawTargetLine({ ...input, target: debug.target, color: "#e9c46a" });
  if (input.debugFlags.navigation && debug?.waypoint) drawTargetLine({ ...input, target: debug.waypoint, color: "#76d7ea" });
}

interface TargetLineInput extends EntityDebugInput {
  readonly target: { readonly x: number; readonly y: number };
  readonly color: string;
}

function drawTargetLine(input: TargetLineInput): void {
  const to = adminMapEntityScreenPoint(input.target, input.center, input.context.canvas);
  input.context.strokeStyle = input.color;
  input.context.setLineDash([3, 3]);
  input.context.beginPath();
  input.context.moveTo(input.point.x, input.point.y);
  input.context.lineTo(to.x, to.y);
  input.context.stroke();
  input.context.setLineDash([]);
}

function drawBehavior(input: EntityDebugInput): void {
  const behavior = input.entity.debug?.behavior;
  if (!behavior || (!input.debugFlags.behavior && behavior !== "searching")) return;
  input.context.fillStyle = behavior === "searching" ? "#f0c36a" : "#b5c5de";
  input.context.font = "9px system-ui";
  input.context.fillText(behavior, input.point.x + 8, input.point.y - 8);
}

function entityColor(kind: AdminMapEntity["kind"]): string {
  if (kind === "player") return "#f4d35e";
  if (kind === "enemy") return "#ef6b73";
  if (kind === "weapon") return "#72d6e5";
  if (kind === "item") return "#c3a5f5";
  return "#f39c5a";
}
