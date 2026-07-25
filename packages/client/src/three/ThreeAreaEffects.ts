/** Renders authoritative area tiles as bounded, fog-aware instanced surfaces. */
import type { World } from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import * as THREE from "three";
import {
  threeAreaPresentation,
  type ThreeAreaPresentation,
} from "./threeAreaPresentation.js";

interface AreaTile {
  x: number;
  z: number;
  y: number;
}

const tileKey = (key: string): { x: number; z: number } | null => {
  const x = Number(key.split(",")[0]);
  const z = Number(key.split(",")[1]);
  return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
};

export class ThreeAreaEffects {
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(0.92, 0.92);
  private readonly materials: Array<{
    emissiveIntensity: number;
    dispose(): void;
  }> = [];
  private signature = "";

  constructor(scene: { add(...objects: unknown[]): void }) {
    scene.add(this.group);
  }

  update(
    connection: Connection,
    world: World,
    timeMs: number,
    reducedMotion: boolean,
  ): void {
    const signature = JSON.stringify([...connection.areaTiles]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild(connection.areaTiles, world);
    }
    const pulse = reducedMotion
      ? 0.72
      : 0.72 + Math.sin(timeMs / 420) * 0.12;
    for (const material of this.materials) material.emissiveIntensity = pulse;
  }

  dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.group.removeFromParent();
  }

  private rebuild(tiles: ReadonlyMap<string, string>, world: World): void {
    this.clear();
    const buckets = new Map<string, {
      presentation: ThreeAreaPresentation;
      tiles: AreaTile[];
    }>();
    for (const [key, effectId] of tiles) {
      const point = tileKey(key);
      if (!point) continue;
      const presentation = threeAreaPresentation(effectId);
      const bucketKey = JSON.stringify(presentation);
      const bucket = buckets.get(bucketKey) ?? { presentation, tiles: [] };
      bucket.tiles.push({
        x: point.x + 0.5,
        z: point.z + 0.5,
        y: world.groundAt(point.x + 0.5, point.z + 0.5) + 0.018,
      });
      buckets.set(bucketKey, bucket);
    }
    for (const bucket of buckets.values()) this.addBucket(bucket);
  }

  private addBucket(bucket: {
    presentation: ThreeAreaPresentation;
    tiles: AreaTile[];
  }): void {
    const material = new THREE.MeshStandardMaterial({
      color: bucket.presentation.color,
      emissive: bucket.presentation.emissive,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: bucket.presentation.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(
      this.geometry,
      material,
      bucket.tiles.length,
    );
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, 0, 0),
    );
    for (const [index, tile] of bucket.tiles.entries()) {
      matrix.compose(
        new THREE.Vector3(tile.x, tile.y, tile.z),
        rotation,
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.materials.push(material);
    this.group.add(mesh);
  }

  private clear(): void {
    this.group.clear();
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
  }
}
