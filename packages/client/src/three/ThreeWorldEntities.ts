/** Renders authoritative pickups, projectiles, and torches in first person. */
import type { InterpolatedEntity } from "../net/interpolate.js";
import { TICK_RATE } from "@dc2d/engine";
import * as THREE from "three";
import { threeEntityPresentation, type ThreeEntityPresentation } from "./threeEntityPresentation.js";
import { createThreeTextSprite, updateThreeTextSprite } from "./ThreeTextSprite.js";
import { threeGroundedDepth } from "./threeGroundedDepth.js";
import { createThreeLootChest } from "./threeLootChest.js";
import { phaseFor } from "./worldEntities/types.js";
import type { ActiveEntity, LootLabelUpdate, RenderNode, RenderObject, TransformUpdate, WorldEntityUpdate } from "./worldEntities/types.js";

export class ThreeWorldEntities {
  private readonly group = new THREE.Group();
  private readonly entities = new Map<string, ActiveEntity>();
  private readonly activeIds = new Set<string>();

  constructor(scene: { add(...objects: unknown[]): void }) {
    scene.add(this.group);
  }
  update({ interpolated, timeMs, reducedMotion, serverTick, self }: WorldEntityUpdate): void {
    const active = this.activeIds;
    active.clear();
    for (const entity of interpolated) {
      this.syncEntity(entity, { timeMs, reducedMotion, serverTick, self }, active);
    }
    for (const [id, entity] of this.entities) {
      if (!active.has(id)) this.remove(id, entity);
    }
  }

  dispose(): void {
    for (const [id, entity] of this.entities) this.remove(id, entity);
    this.group.removeFromParent();
  }
  private add(
    id: string,
    presentation: ThreeEntityPresentation,
  ): ActiveEntity {
    const object = this.createObject(presentation);
    const entity = { object, presentation, phase: phaseFor(id) };
    this.entities.set(id, entity);
    this.group.add(object);
    return entity;
  }

  private syncEntity(
    source: InterpolatedEntity,
    frame: Omit<WorldEntityUpdate, "interpolated">,
    active: Set<string>,
  ): void {
    const presentation = threeEntityPresentation(source.snap);
    if (!presentation) return;
    active.add(source.id);
    const entity = this.entities.get(source.id) ?? this.add(source.id, presentation);
    entity.presentation = presentation;
    this.updateTransform({
      entity,
      position: { x: source.x, y: source.z, z: source.y },
      time: frame.reducedMotion ? 0 : frame.timeMs / 1000,
    });
    this.updateLootLabel({ entity, presentation, source, ...frame });
  }
  private createObject(presentation: ThreeEntityPresentation): RenderObject {
    if (presentation.kind === "torch") return this.createTorch(presentation);
    if (presentation.kind === "lootChest") return createThreeLootChest(presentation);
    const geometry = presentation.kind === "projectile"
      ? new THREE.SphereGeometry(1, 8, 6)
      : new THREE.OctahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: presentation.color,
      emissive: presentation.emissive,
      emissiveIntensity: presentation.kind === "projectile" ? 1.8 : 0.35,
      roughness: 0.55,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(presentation.scale);
    return mesh as RenderObject;
  }
  private createTorch(
    presentation: ThreeEntityPresentation,
  ): RenderObject {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.35, 6),
      new THREE.MeshStandardMaterial({ color: presentation.color }),
    );
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({
        color: "#ffb45e",
        emissive: presentation.emissive,
        emissiveIntensity: 2.5,
      }),
    );
    flame.position.y = 0.21;
    group.add(handle, flame);
    group.scale.setScalar(presentation.scale / 0.2);
    return group as RenderObject;
  }

  private updateLootLabel({ entity, presentation, source, serverTick, self }: LootLabelUpdate): void {
    if (presentation.kind !== "lootChest") return;
    this.ensureLootLabel(entity, presentation);
    const timer = this.ensureLootTimer(entity);
    const nearby = Math.hypot(source.x - self.x, source.y - self.y) <= 3.5;
    timer.visible = nearby;
    if (!nearby) return;
    const seconds = Math.ceil(Math.max(0, (presentation.unlockAtTick ?? 0) - serverTick) / TICK_RATE);
    const text = seconds > 0 ? `First dibs: ${seconds}s` : "Loot unlocked";
    this.updateLootTimerText(entity, timer, text);
  }

  private ensureLootLabel(entity: ActiveEntity, presentation: ThreeEntityPresentation): void {
    if (entity.label) return;
    entity.label = createThreeTextSprite(presentation.label ?? "Death loot", "#f4d7b2");
    entity.label.position.y = 1.05;
    entity.object.add(entity.label);
  }

  private ensureLootTimer(entity: ActiveEntity): NonNullable<ActiveEntity["timer"]> {
    if (entity.timer) return entity.timer;
    entity.timer = createThreeTextSprite("", "#ffd86a");
    entity.timer.position.y = -0.28;
    entity.object.add(entity.timer);
    return entity.timer;
  }

  private updateLootTimerText(entity: ActiveEntity, timer: NonNullable<ActiveEntity["timer"]>, text: string): void {
    if (text === entity.timerText) return;
    entity.timerText = text;
    updateThreeTextSprite(timer, text, "#ffd86a");
  }

  private updateTransform({ entity, position, time }: TransformUpdate): void {
    const bob = entity.presentation.bob
      ? Math.sin(time * 2.2 + entity.phase) * 0.035
      : 0;
    const vertical = entity.presentation.kind === "lootChest"
      ? threeGroundedDepth(position.y, entity.presentation.elevation).worldY
      : position.y + entity.presentation.elevation + bob;
    entity.object.position.set(position.x, vertical, position.z);
    if (entity.presentation.spin) entity.object.rotation.y =
      time * 1.8 + entity.phase;
  }

  private remove(id: string, entity: ActiveEntity): void {
    entity.object.traverse((object: RenderNode) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material ? [object.material] : [];
      for (const material of materials) material.dispose();
    });
    entity.object.removeFromParent();
    this.entities.delete(id);
  }
}
