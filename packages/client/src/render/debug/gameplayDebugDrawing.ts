import type Phaser from "phaser";
import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import {
  activeHitboxes,
  activeGuardArea,
  activeSearch,
  hitboxCircle,
  hitboxTile,
  hitboxWedge,
  boxCrossSection,
  boxWireframe,
  circleOutline,
  combatHurtbox,
  currentLineOfSight,
  navigationPath,
  tileOutline,
  wedgeOutline,
} from "./adminDebugGeometry.js";
import { attackVolumeGeometry } from "./attack/adminDebugAttackVolumeGeometry.js";
import {
  drawGameplayLine,
  drawGameplayWorldMarker,
} from "./gameplayDebugLineDrawing.js";
import { drawGameplayMovementCollision } from "./gameplayMovementCollisionDrawing.js";
const COLORS = {
  hurtbox: 0xf7c55c,
  hitbox: 0xf3727d,
  guard: 0x78c6e8,
  lineOfSight: 0xe9c46a,
  search: 0xc48df2,
  navigation: 0x76d7ea,
};

export interface GameplayDebugDrawingInput {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly flags: DebugFlags;
  readonly entity: AdminMapEntity;
  readonly hurtboxStrikeHeights?: readonly number[];
}

export function drawGameplayEntityDebug(input: GameplayDebugDrawingInput): void {
  drawGameplayCombatDebug(input);
  drawGameplayAwarenessDebug(input);
}

function drawGameplayCombatDebug(input: GameplayDebugDrawingInput): void {
  if (input.flags.hurtboxes) drawHurtbox(input);
  if (input.flags.movementCollision) drawGameplayMovementCollision(input);
  if (input.flags.attacks || input.flags.hitboxPreview) drawHitboxes(input);
  if (input.flags.guards) drawGuard(input);
}

function drawGameplayAwarenessDebug(input: GameplayDebugDrawingInput): void {
  if (input.flags.lineOfSight) drawLineOfSight(input);
  if (input.flags.search) drawSearch(input);
  if (input.flags.navigation) drawNavigation(input);
}

function drawHurtbox(input: GameplayDebugDrawingInput): void {
  const hurtbox = combatHurtbox(input.entity);
  if (!hurtbox) return;
  for (const points of boxWireframe(hurtbox)) {
    drawGameplayLine({ ...input, points, color: COLORS.hurtbox, alpha: 0.72, width: 2 });
  }
  for (const z of input.hurtboxStrikeHeights ?? []) {
    const points = boxCrossSection(hurtbox, z);
    if (points) drawGameplayLine({ ...input, points, color: COLORS.hurtbox, alpha: 1, width: 3 });
  }
}

function drawHitboxes(input: GameplayDebugDrawingInput): void {
  for (const hitbox of activeHitboxes(input.entity)) drawHitbox(input, hitbox);
}

function drawHitbox(
  input: GameplayDebugDrawingInput,
  hitbox: ReturnType<typeof activeHitboxes>[number],
): void {
  const volume = attackVolumeGeometry(input.entity, hitbox);
  const preview = "preview" in hitbox && hitbox.preview === true;
  if (volume) return drawAttackVolume(input, preview, volume);
  if (hitbox.shape === "circle") {
    drawGameplayLine({ ...input, points: circleOutline(hitboxCircle(input.entity, hitbox)), color: COLORS.hitbox, width: 2 });
    return;
  }
  if (hitbox.shape === "cone") {
    drawGameplayLine({ ...input, points: wedgeOutline(hitboxWedge(input.entity, hitbox)), color: COLORS.hitbox, width: 2 });
    return;
  }
  drawGameplayLine({ ...input, points: tileOutline(hitboxTile(hitbox)), color: COLORS.hitbox, width: 2 });
}

function drawAttackVolume(
  input: GameplayDebugDrawingInput,
  preview: boolean,
  volume: NonNullable<ReturnType<typeof attackVolumeGeometry>>,
): void {
  const shellAlpha = preview ? 0.55 : 0.42;
  for (const points of volume.shell) {
    drawGameplayLine({ ...input, points, color: COLORS.hitbox, alpha: shellAlpha });
  }
  drawGameplayLine({
    ...input,
    points: volume.strike,
    color: COLORS.hitbox,
    alpha: preview ? 0.9 : 1,
    width: 2,
  });
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
  drawGameplayWorldMarker(input.graphics, search.anchor, COLORS.search);
  if (search.target) drawGameplayLine({ ...input, points: [search.anchor, search.target], color: COLORS.search });
  if (search.waypoint) drawGameplayLine({ ...input, points: [input.entity, search.waypoint], color: COLORS.search });
}

function drawNavigation(input: GameplayDebugDrawingInput): void {
  const path = navigationPath(input.entity);
  if (path.length > 0) drawGameplayLine({ ...input, points: [input.entity, ...path], color: COLORS.navigation });
}

export { gameplayDebugScreenPoint } from "./gameplayDebugProjection.js";
