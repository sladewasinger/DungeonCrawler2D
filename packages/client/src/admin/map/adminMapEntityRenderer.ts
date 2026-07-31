import type { AdminMap, AdminMapEntity, DebugFlags } from "@dc2d/engine";
import { pointIsNearCanvas, type AdminMapCenter } from "./adminMapCamera.js";
import { adminMapEntityScreenPoint } from "./adminMapEntityHitTest.js";
import {
  drawAdminMapEntityDebug,
  type AdminMapEntityPoint,
} from "./adminMapEntityDebugRenderer.js";

export interface AdminMapEntityRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly center: AdminMapCenter;
  readonly tileSize: number;
  readonly debugFlags: DebugFlags;
}

export function drawAdminMapEntities(input: AdminMapEntityRenderInput): void {
  for (const entity of input.map.entities) drawEntity(input, entity);
}

function drawEntity(input: AdminMapEntityRenderInput, entity: AdminMapEntity): void {
  const point = entityPoint(input, entity);
  if (!pointIsNearCanvas(point, input.context.canvas, input.tileSize)) return;
  drawEntityDot(input.context, entity, point);
  drawAdminMapEntityDebug({ ...input, entity, point });
}

function entityPoint(
  input: AdminMapEntityRenderInput,
  entity: AdminMapEntity,
): AdminMapEntityPoint {
  return adminMapEntityScreenPoint({
    world: entity,
    center: input.center,
    canvas: input.context.canvas,
    tileSize: input.tileSize,
  });
}

function drawEntityDot(
  context: CanvasRenderingContext2D,
  entity: AdminMapEntity,
  point: AdminMapEntityPoint,
): void {
  context.fillStyle = entityColor(entity.kind);
  context.beginPath();
  context.arc(point.x, point.y, entityMarkerRadius(entity.kind), 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#e9edf5";
  context.font = "10px system-ui";
  context.fillText(entity.name ?? entity.defId ?? entity.kind, point.x + 8, point.y + 3);
}

function entityMarkerRadius(kind: AdminMapEntity["kind"]): number {
  if (kind === "player") return 7;
  if (kind === "pet") return 6;
  if (kind === "projectile") return 3;
  return 5;
}

function entityColor(kind: AdminMapEntity["kind"]): string {
  if (kind === "player") return "#f4d35e";
  if (kind === "enemy") return "#ef6b73";
  if (kind === "pet") return "#72e6ad";
  if (kind === "weapon") return "#72d6e5";
  if (kind === "item") return "#c3a5f5";
  if (kind === "projectile") return "#f7c55c";
  return "#f39c5a";
}
