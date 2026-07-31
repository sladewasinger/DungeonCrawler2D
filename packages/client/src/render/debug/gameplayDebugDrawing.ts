import type Phaser from "phaser";
import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import {
  activeAttackAreas,
  activeGuardArea,
  activeSearch,
  attackCircle,
  attackTile,
  attackWedge,
  boxOutline,
  circleOutline,
  combatHurtbox,
  currentLineOfSight,
  navigationPath,
  tileOutline,
  wedgeOutline,
  type AdminDebugPoint,
} from "./adminDebugGeometry.js";
import { groundToScreen } from "../entities/geometry/worldToScreen.js";

const COLORS = {
  hurtbox: 0xf7c55c,
  attack: 0xf3727d,
  guard: 0x78c6e8,
  lineOfSight: 0xe9c46a,
  search: 0xc48df2,
  navigation: 0x76d7ea,
};

export interface GameplayDebugDrawingInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly flags: DebugFlags;
  readonly entity: AdminMapEntity;
}

export function drawGameplayEntityDebug(input: GameplayDebugDrawingInput): void {
  if (input.flags.hurtboxes) drawHurtbox(input);
  if (input.flags.attacks) drawAttacks(input);
  if (input.flags.guards) drawGuard(input);
  if (input.flags.lineOfSight) drawLineOfSight(input);
  if (input.flags.search) drawSearch(input);
  if (input.flags.navigation) drawNavigation(input);
}

function drawHurtbox(input: GameplayDebugDrawingInput): void {
  const hurtbox = combatHurtbox(input.entity);
  if (!hurtbox) return;
  drawGameplayLine({ ...input, points: boxOutline(hurtbox), color: COLORS.hurtbox });
}

function drawAttacks(input: GameplayDebugDrawingInput): void {
  for (const attack of activeAttackAreas(input.entity)) drawAttack(input, attack);
}

function drawAttack(
  input: GameplayDebugDrawingInput,
  attack: ReturnType<typeof activeAttackAreas>[number],
): void {
  if (attack.shape === "circle") {
    drawGameplayLine({ ...input, points: circleOutline(attackCircle(input.entity, attack)), color: COLORS.attack, width: 2 });
    return;
  }
  if (attack.shape === "cone") {
    drawGameplayLine({ ...input, points: wedgeOutline(attackWedge(input.entity, attack)), color: COLORS.attack, width: 2 });
    return;
  }
  drawGameplayLine({ ...input, points: tileOutline(attackTile(attack)), color: COLORS.attack, width: 2 });
}

function drawGuard(input: GameplayDebugDrawingInput): void {
  const guard = activeGuardArea(input.entity);
  if (guard) drawGameplayLine({ ...input, points: wedgeOutline(guard), color: COLORS.guard, width: 2 });
}

function drawLineOfSight(input: GameplayDebugDrawingInput): void {
  const target = currentLineOfSight(input.entity);
  if (target) drawGameplayLine({ ...input, points: [input.entity, target], color: COLORS.lineOfSight });
}

function drawSearch(input: GameplayDebugDrawingInput): void {
  const search = activeSearch(input.entity);
  if (!search) return;
  drawWorldMarker(input, search.anchor, COLORS.search);
  if (search.target) drawGameplayLine({ ...input, points: [search.anchor, search.target], color: COLORS.search });
  if (search.waypoint) drawGameplayLine({ ...input, points: [input.entity, search.waypoint], color: COLORS.search });
}

function drawNavigation(input: GameplayDebugDrawingInput): void {
  const path = navigationPath(input.entity);
  if (path.length > 0) drawGameplayLine({ ...input, points: [input.entity, ...path], color: COLORS.navigation });
}

function drawWorldMarker(
  input: GameplayDebugDrawingInput,
  point: AdminDebugPoint,
  color: number,
): void {
  const size = 0.18;
  drawGameplayLine({
    ...input,
    points: [{ x: point.x - size, y: point.y, z: point.z }, { x: point.x + size, y: point.y, z: point.z }],
    color,
  });
  drawGameplayLine({
    ...input,
    points: [{ x: point.x, y: point.y - size, z: point.z }, { x: point.x, y: point.y + size, z: point.z }],
    color,
  });
}

interface GameplayDebugLineInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly points: readonly AdminDebugPoint[];
  readonly color: number;
  readonly width?: number;
}

function drawGameplayLine(input: GameplayDebugLineInput): void {
  if (input.points.length < 2) return;
  const first = gameplayDebugScreenPoint(input.points[0]!);
  input.graphics.lineStyle(input.width ?? 1, input.color, 0.9);
  input.graphics.beginPath();
  input.graphics.moveTo(first.x, first.y);
  for (const point of input.points.slice(1)) {
    const screen = gameplayDebugScreenPoint(point);
    input.graphics.lineTo(screen.x, screen.y);
  }
  input.graphics.strokePath();
}

/** Projects authoritative 3D debug geometry through Phaser's elevation seam. */
export function gameplayDebugScreenPoint(
  point: AdminDebugPoint,
): { readonly x: number; readonly y: number } {
  return groundToScreen(point.x, point.y, point.z);
}
