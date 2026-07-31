import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import {
  activeHitboxes,
  activeGuardArea,
  activeSearch,
  hitboxCircle,
  hitboxTile,
  hitboxWedge,
  boxWireframe,
  circleOutline,
  combatHurtbox,
  currentLineOfSight,
  navigationPath,
  tileOutline,
  wedgeOutline,
  type AdminDebugPoint,
} from "../../../render/debug/adminDebugGeometry.js";
import { attackVolumeGeometry } from "../../../render/debug/attack/adminDebugAttackVolumeGeometry.js";
import type { ThreeDebugPrimitiveWriter } from "./threeDebugPrimitives.js";

const COLORS = {
  hurtbox: 0xf7c55c,
  hitbox: 0xf3727d,
  guard: 0x78c6e8,
  lineOfSight: 0xe9c46a,
  search: 0xc48df2,
  navigation: 0x76d7ea,
};

export function addThreeEntityDebug(
  writer: ThreeDebugPrimitiveWriter,
  flags: DebugFlags,
  entity: AdminMapEntity,
): void {
  if (flags.hurtboxes) addHurtbox(writer, entity);
  if (flags.attacks) addHitboxes(writer, entity);
  if (flags.guards) addGuard(writer, entity);
  if (flags.lineOfSight) addLineOfSight(writer, entity);
  if (flags.search) addSearch(writer, entity);
  if (flags.navigation) addNavigation(writer, entity);
  if (flags.behavior) addBehavior(writer, entity);
}

function addHurtbox(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const hurtbox = combatHurtbox(entity);
  if (!hurtbox) return;
  for (const line of boxWireframe(hurtbox)) writer.line(line, COLORS.hurtbox);
}

function addHitboxes(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  for (const hitbox of activeHitboxes(entity)) addHitbox(writer, entity, hitbox);
}

function addHitbox(
  writer: ThreeDebugPrimitiveWriter,
  entity: AdminMapEntity,
  hitbox: ReturnType<typeof activeHitboxes>[number],
): void {
  const volume = attackVolumeGeometry(entity, hitbox);
  if (volume) {
    for (const line of volume.shell) writer.line(line, COLORS.hitbox, 0.08);
    writer.line(volume.strike, 0xffa2aa, 0.1);
    return;
  }
  if (hitbox.shape === "circle") {
    writer.line(circleOutline(hitboxCircle(entity, hitbox)), COLORS.hitbox, 0.11);
    return;
  }
  if (hitbox.shape === "cone") {
    writer.line(wedgeOutline(hitboxWedge(entity, hitbox)), COLORS.hitbox, 0.11);
    return;
  }
  writer.line(tileOutline(hitboxTile(hitbox)), COLORS.hitbox, 0.11);
}

function addGuard(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const guard = activeGuardArea(entity);
  if (guard) writer.line(wedgeOutline(guard), COLORS.guard, 0.1);
}

function addLineOfSight(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const target = currentLineOfSight(entity);
  if (target) writer.line([entity, target], COLORS.lineOfSight, 0.13);
}

function addSearch(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const search = activeSearch(entity);
  if (!search) return;
  addMarker(writer, search.anchor, COLORS.search);
  if (search.target) writer.line([search.anchor, search.target], COLORS.search, 0.13);
  if (search.waypoint) writer.line([entity, search.waypoint], COLORS.search, 0.13);
}

function addNavigation(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const path = navigationPath(entity);
  if (path.length > 0) writer.line([entity, ...path], COLORS.navigation, 0.1);
}

function addBehavior(writer: ThreeDebugPrimitiveWriter, entity: AdminMapEntity): void {
  const behavior = entity.debug?.behavior;
  if (!behavior) return;
  writer.behaviorLabel(entity.id, behavior.toUpperCase(), entity);
}

function addMarker(
  writer: ThreeDebugPrimitiveWriter,
  point: AdminDebugPoint,
  color: number,
): void {
  const size = 0.18;
  writer.line([
    { x: point.x - size, y: point.y, z: point.z },
    { x: point.x + size, y: point.y, z: point.z },
  ], color, 0.12);
  writer.line([
    { x: point.x, y: point.y - size, z: point.z },
    { x: point.x, y: point.y + size, z: point.z },
  ], color, 0.12);
}
