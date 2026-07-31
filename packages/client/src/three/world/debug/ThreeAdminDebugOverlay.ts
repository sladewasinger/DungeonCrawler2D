import type { AdminMapEntity, DebugFlags } from "@dc2d/engine";
import * as THREE from "three";
import { createThreeTextSprite } from "../entities/ThreeTextSprite.js";
import { disposeDebugGroup } from "./ThreeDebugDisposal.js";

const HURTBOX_RADIUS = 0.3;

/** Private diagnostic geometry for the active admin's first-person world. */
export class ThreeAdminDebugOverlay {
  private readonly group = new THREE.Group();
  private revision = "";

  constructor(scene: InstanceType<typeof THREE.Scene>) {
    scene.add(this.group);
  }

  update(input: ThreeDebugOverlayInput): void {
    const revision = overlayRevision(input);
    if (revision === this.revision) return;
    this.revision = revision;
    disposeDebugGroup(this.group);
    if (!input.active || !hasEnabledFlag(input.flags)) return;
    for (const entity of input.entities) addEntityOverlay(this.group, input.flags, entity);
  }

  dispose(): void {
    disposeDebugGroup(this.group);
    this.group.removeFromParent();
  }
}

interface ThreeDebugOverlayInput {
  readonly active: boolean;
  readonly flags: DebugFlags;
  readonly entities: readonly AdminMapEntity[];
  readonly tick: number;
}

function overlayRevision(input: ThreeDebugOverlayInput): string {
  return `${input.active}:${input.tick}:${Object.values(input.flags).join("")}`;
}

function hasEnabledFlag(flags: DebugFlags): boolean {
  return Object.values(flags).some(Boolean);
}

function addEntityOverlay(
  group: InstanceType<typeof THREE.Group>,
  flags: DebugFlags,
  entity: AdminMapEntity,
): void {
  addHurtbox(group, flags, entity);
  addAttackFacing({ group, flags, entity });
  addGuardIfBlocking(group, flags, entity);
  addDebugLinks({ group, flags, entity });
  addBehavior(group, flags, entity);
}

function addHurtbox(group: InstanceType<typeof THREE.Group>, flags: DebugFlags, entity: AdminMapEntity): void {
  if (flags.hurtboxes) group.add(hurtbox(entity));
}

function addGuardIfBlocking(group: InstanceType<typeof THREE.Group>, flags: DebugFlags, entity: AdminMapEntity): void {
  if (flags.guards && entity.blocking) addGuard(group, entity);
}

function hurtbox(entity: AdminMapEntity): InstanceType<typeof THREE.Mesh> {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(HURTBOX_RADIUS - 0.025, HURTBOX_RADIUS, 16),
    new THREE.MeshBasicMaterial({ color: 0xf7c55c, transparent: true, opacity: 0.85, depthTest: false }),
  );
  const point = threePoint(entity);
  mesh.position.set(point.x, point.y + 0.025, point.z);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function addAttackFacing(input: {
  readonly group: InstanceType<typeof THREE.Group>;
  readonly flags: DebugFlags;
  readonly entity: AdminMapEntity;
}): void {
  const { group, flags, entity } = input;
  const facing = flags.attacks ? entity.facing : undefined;
  if (!facing) return;
  const start = threePoint(entity, 0.1);
  const end = new THREE.Vector3(start.x + facing.x * 0.75, start.y, start.z + facing.y * 0.75);
  group.add(line([start, end], 0xf3727d));
}

function addGuard(group: InstanceType<typeof THREE.Group>, entity: AdminMapEntity): void {
  const facing = entity.facing ?? { x: 1, y: 0 };
  const start = threePoint(entity, 0.08);
  const angle = Math.atan2(facing.y, facing.x);
  const points = [-0.58, 0, 0.58].map((offset) => new THREE.Vector3(
    start.x + Math.cos(angle + offset) * 0.55,
    start.y,
    start.z + Math.sin(angle + offset) * 0.55,
  ));
  group.add(line([points[0]!, start, points[2]!], 0x78c6e8));
}

function addDebugLinks(input: {
  readonly group: InstanceType<typeof THREE.Group>;
  readonly flags: DebugFlags;
  readonly entity: AdminMapEntity;
}): void {
  const { group, flags, entity } = input;
  if (flags.lineOfSight && entity.debug?.target) addLink({ group, source: entity, target: entity.debug.target, color: 0xe9c46a });
  if (flags.navigation && entity.debug?.waypoint) addLink({ group, source: entity, target: entity.debug.waypoint, color: 0x76d7ea });
}

function addLink(input: {
  readonly group: InstanceType<typeof THREE.Group>;
  readonly source: AdminMapEntity;
  readonly target: { x: number; y: number; z: number };
  readonly color: number;
}): void {
  const { group, source, target, color } = input;
  group.add(line([threePoint(source, 0.12), threePoint(target, 0.12)], color));
}

function addBehavior(group: InstanceType<typeof THREE.Group>, flags: DebugFlags, entity: AdminMapEntity): void {
  const behavior = entity.debug?.behavior;
  if (!behavior || (!flags.behavior && behavior !== "searching")) return;
  const label = createThreeTextSprite(behavior.toUpperCase(), "#eaf4ff") as unknown as InstanceType<typeof THREE.Sprite>;
  const point = threePoint(entity, 1.45);
  label.position.copy(point);
  group.add(label);
}

function line(points: Array<InstanceType<typeof THREE.Vector3>>, color: number): InstanceType<typeof THREE.Line> {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }),
  );
}

function threePoint(
  point: { x: number; y: number; z: number },
  lift = 0,
): InstanceType<typeof THREE.Vector3> {
  return new THREE.Vector3(point.x, point.z + lift, point.y);
}
