/** Renders authoritative pickups, projectiles, and torches in first person. */
import type { Connection } from "../net/connection.js";
import * as THREE from "three";
import {
  threeEntityPresentation,
  type ThreeEntityPresentation,
} from "./threeEntityPresentation.js";

interface ActiveEntity {
  object: RenderObject;
  presentation: ThreeEntityPresentation;
  phase: number;
}

interface RenderObject {
  position: { set(x: number, y: number, z: number): void };
  rotation: { y: number };
  scale: { setScalar(value: number): void };
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

  constructor(scene: { add(...objects: unknown[]): void }) {
    scene.add(this.group);
  }

  update(
    connection: Connection,
    timeMs: number,
    reducedMotion: boolean,
  ): void {
    const active = new Set<string>();
    for (const entity of connection.interpolated()) {
      const presentation = threeEntityPresentation(entity.snap);
      if (!presentation) continue;
      active.add(entity.id);
      const rendered = this.entities.get(entity.id) ??
        this.add(entity.id, presentation);
      this.updateTransform(
        rendered,
        entity.x,
        entity.z,
        entity.y,
        reducedMotion ? 0 : timeMs / 1000,
      );
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
