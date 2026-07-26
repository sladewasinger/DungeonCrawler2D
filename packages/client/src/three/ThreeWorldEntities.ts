/** Renders authoritative pickups, projectiles, and torches in first person. */
import type { InterpolatedEntity } from "../net/interpolate.js";
import { TICK_RATE } from "@dc2d/engine";
import * as THREE from "three";
import {
  threeEntityPresentation,
  type ThreeEntityPresentation,
} from "./threeEntityPresentation.js";
import {
  createThreeTextSprite,
  updateThreeTextSprite,
  type ThreeTextSprite,
} from "./ThreeTextSprite.js";

interface ActiveEntity {
  object: RenderObject;
  presentation: ThreeEntityPresentation;
  phase: number;
  label?: ThreeTextSprite;
  timer?: ThreeTextSprite;
  timerText?: string;
}

interface RenderObject {
  position: { set(x: number, y: number, z: number): void };
  rotation: { y: number };
  scale: { setScalar(value: number): void };
  add(...objects: unknown[]): void;
  traverse(callback: (object: RenderNode) => void): void;
  removeFromParent(): void;
}

interface RenderNode {
  geometry?: { dispose(): void };
  material?: { dispose(): void } | Array<{ dispose(): void }>;
}

const phaseFor = (id: string): number => {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 628) / 100;
};

export class ThreeWorldEntities {
  private readonly group = new THREE.Group();
  private readonly entities = new Map<string, ActiveEntity>();
  private readonly activeIds = new Set<string>();

  constructor(scene: { add(...objects: unknown[]): void }) {
    scene.add(this.group);
  }

  update(
    interpolated: readonly InterpolatedEntity[],
    timeMs: number,
    reducedMotion: boolean,
    serverTick = 0,
    self = { x: 0, y: 0 },
  ): void {
    const active = this.activeIds;
    active.clear();
    for (const entity of interpolated) {
      const presentation = threeEntityPresentation(entity.snap);
      if (!presentation) continue;
      active.add(entity.id);
      const rendered = this.entities.get(entity.id) ??
        this.add(entity.id, presentation);
      rendered.presentation = presentation;
      this.updateTransform(
        rendered,
        entity.x,
        entity.z,
        entity.y,
        reducedMotion ? 0 : timeMs / 1000,
      );
      this.updateLootLabel(rendered, presentation, entity, serverTick, self);
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

  private createObject(presentation: ThreeEntityPresentation): RenderObject {
    if (presentation.kind === "torch") return this.createTorch(presentation);
    if (presentation.kind === "lootChest") return this.createLootChest(presentation);
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

  private createLootChest(presentation: ThreeEntityPresentation): RenderObject {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: presentation.color,
      emissive: presentation.emissive,
      roughness: 0.78,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.56), material);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.6), material.clone());
    lid.position.y = 0.3;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.64, 0.62),
      new THREE.MeshStandardMaterial({ color: "#b58b48", metalness: 0.55 }),
    );
    band.position.y = 0.08;
    group.add(base, lid, band);
    return group as RenderObject;
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

  private updateLootLabel(
    entity: ActiveEntity,
    presentation: ThreeEntityPresentation,
    source: InterpolatedEntity,
    serverTick: number,
    self: { x: number; y: number },
  ): void {
    if (presentation.kind !== "lootChest") return;
    if (!entity.label) {
      entity.label = createThreeTextSprite(presentation.label ?? "Death loot", "#f4d7b2");
      entity.label.position.y = 1.05;
      entity.object.add(entity.label);
    }
    if (!entity.timer) {
      entity.timer = createThreeTextSprite("", "#ffd86a");
      entity.timer.position.y = -0.28;
      entity.object.add(entity.timer);
    }
    const nearby = Math.hypot(source.x - self.x, source.y - self.y) <= 3.5;
    entity.timer.visible = nearby;
    if (!nearby) return;
    const seconds = Math.ceil(Math.max(0, (presentation.unlockAtTick ?? 0) - serverTick) / TICK_RATE);
    const text = seconds > 0 ? `First dibs: ${seconds}s` : "Loot unlocked";
    if (text === entity.timerText) return;
    entity.timerText = text;
    updateThreeTextSprite(entity.timer, text, "#ffd86a");
  }

  private updateTransform(
    entity: ActiveEntity,
    x: number,
    y: number,
    z: number,
    time: number,
  ): void {
    const bob = entity.presentation.bob
      ? Math.sin(time * 2.2 + entity.phase) * 0.035
      : 0;
    entity.object.position.set(x, y + entity.presentation.elevation + bob, z);
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
