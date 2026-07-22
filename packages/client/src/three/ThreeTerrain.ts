/** Owns deterministic Three.js terrain and static wall-sconce lighting. */
import type { World } from "@dc2d/engine";
import * as THREE from "three";

export const DEFAULT_TERRAIN_VIEW_RADIUS = 26;
const MIN_HEIGHT = -3;
const SCONCE_CELL_SIZE = 12;

const depthIndex = (height: number) => Math.min(3, Math.max(0, Math.round(-height)));

export class ThreeTerrain {
  private readonly group = new THREE.Group();
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly edges = new THREE.EdgesGeometry(this.cube);
  private readonly sconcePlate = new THREE.BoxGeometry(0.26, 0.38, 0.06);
  private readonly flame = new THREE.SphereGeometry(0.1, 8, 6);
  private readonly floors = ["#59606c", "#4b525e", "#3e4550", "#353c48"].map((color) => new THREE.MeshLambertMaterial({ color }));
  private readonly walls = ["#3b385f", "#332f54", "#292646", "#211f38"].map((color) => new THREE.MeshLambertMaterial({ color }));
  private readonly borderMaterial = new THREE.LineBasicMaterial({ color: "#0a0a10" });
  private readonly sconceMaterial = new THREE.MeshStandardMaterial({ color: "#5a514a", roughness: 0.72 });
  private readonly flameMaterial = new THREE.MeshStandardMaterial({ color: "#ff9e44", emissive: "#ff5d1a", emissiveIntensity: 3 });
  constructor(private readonly world: World, scene: object & { add(...objects: unknown[]): void }, private viewRadius = DEFAULT_TERRAIN_VIEW_RADIUS) {
    scene.add(this.group);
  }

  setViewRadius(viewRadius: number): void {
    this.viewRadius = viewRadius;
  }

  rebuild(origin: { x: number; z: number }): void {
    this.group.clear();
    this.populateTiles(origin);
  }

  update(time: number): void {
    void time;
  }

  dispose(): void {
    this.group.clear();
    this.group.removeFromParent();
    [this.cube, this.edges, this.sconcePlate, this.flame].forEach((geometry) => geometry.dispose());
    [...this.floors, ...this.walls, this.borderMaterial, this.sconceMaterial, this.flameMaterial].forEach((material) => material.dispose());
  }

  private populateTiles(origin: { x: number; z: number }): void {
    for (let z = origin.z - this.viewRadius; z <= origin.z + this.viewRadius; z += 1) this.populateRow(origin, z);
    this.populateSconces(origin);
  }

  private populateRow(origin: { x: number; z: number }, z: number): void {
    for (let x = origin.x - this.viewRadius; x <= origin.x + this.viewRadius; x += 1) this.populateTile(x, z);
  }

  private populateTile(x: number, z: number): void {
    const height = Math.max(MIN_HEIGHT + 0.25, Math.min(7, this.world.heightAt(x, z)));
    if (this.world.isWalkable(x, z)) return this.addWalkableTile(x, z, height);
    this.addBlock(x, z, this.walls[depthIndex(height)], height + 1);
  }

  private addWalkableTile(x: number, z: number, height: number): void {
    this.addBlock(x, z, this.floors[depthIndex(height)], height);
  }

  private addBlock(x: number, z: number, material: unknown, top: number): void {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.position.set(x + 0.5, (MIN_HEIGHT + top) / 2, z + 0.5);
    mesh.scale.set(1, Math.max(0.08, top - MIN_HEIGHT), 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const outline = new THREE.LineSegments(this.edges, this.borderMaterial);
    outline.position.copy(mesh.position);
    outline.scale.copy(mesh.scale);
    this.group.add(mesh, outline);
  }

  private populateSconces(origin: { x: number; z: number }): void {
    const min = { x: origin.x - this.viewRadius, z: origin.z - this.viewRadius };
    const max = { x: origin.x + this.viewRadius, z: origin.z + this.viewRadius };
    const firstX = Math.floor(min.x / SCONCE_CELL_SIZE);
    const firstZ = Math.floor(min.z / SCONCE_CELL_SIZE);
    const lastX = Math.floor(max.x / SCONCE_CELL_SIZE);
    const lastZ = Math.floor(max.z / SCONCE_CELL_SIZE);
    for (let z = firstZ; z <= lastZ; z += 1) {
      for (let x = firstX; x <= lastX; x += 1) this.addCellSconce(x, z, min, max);
    }
  }

  private addCellSconce(cellX: number, cellZ: number, min: { x: number; z: number }, max: { x: number; z: number }): void {
    const location = this.findSconceLocation(cellX, cellZ);
    if (!location || location.x < min.x || location.x > max.x || location.z < min.z || location.z > max.z) return;
    this.addSconce(location.x, location.z, this.world.heightAt(location.x, location.z));
  }

  private findSconceLocation(cellX: number, cellZ: number): { x: number; z: number } | null {
    const start = Math.abs(cellX * 31 + cellZ * 17) % (SCONCE_CELL_SIZE ** 2);
    for (let index = 0; index < SCONCE_CELL_SIZE ** 2; index += 1) {
      const offset = (start + index) % (SCONCE_CELL_SIZE ** 2);
      const x = cellX * SCONCE_CELL_SIZE + (offset % SCONCE_CELL_SIZE);
      const z = cellZ * SCONCE_CELL_SIZE + Math.floor(offset / SCONCE_CELL_SIZE);
      if (!this.world.isWalkable(x, z)) return { x, z };
    }
    return null;
  }

  private addSconce(x: number, z: number, height: number): void {
    const y = Math.min(height + 0.72, 1.5);
    const plate = new THREE.Mesh(this.sconcePlate, this.sconceMaterial);
    plate.position.set(x + 0.5, y, z + 1.015);
    const flame = new THREE.Mesh(this.flame, this.flameMaterial);
    flame.position.set(x + 0.5, y + 0.18, z + 1.08);
    const light = new THREE.PointLight("#ffae62", 10, 9, 2);
    light.position.set(x + 0.5, y + 0.15, z + 0.82);
    this.group.add(plate, flame, light);
  }

}
