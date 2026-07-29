/** Owns deterministic Three.js terrain and bounded wall-sconce lighting. */
import { TILE, biomeAtWorldTile, type World } from "@dc2d/engine";
import * as THREE from "three";
import { environmentProfile } from "./threeEnvironment.js";
import { createBiomeMaterials, disposeBiomeMaterials, type BiomeMaterials } from "./threeTerrainPalette.js";
import type { ViewDistance } from "../view/viewDistance.js";
import { visibleSconceLocations } from "../sconceLocations.js";
import type { TerrainBlock, TerrainCell, TerrainTile } from "../types.js";

export const DEFAULT_TERRAIN_VIEW_RADIUS = 26;
const MIN_HEIGHT = -3;
/** 3D voids are rendered as a tall black volume; this keeps them effectively
 * infinite for the bounded view without creating unbounded geometry. */
const VOID_RENDER_TOP = 10;

const depthIndex = (height: number) => Math.min(3, Math.max(0, Math.round(-height)));

export class ThreeTerrain {
  private readonly group = new THREE.Group();
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly edges = new THREE.EdgesGeometry(this.cube);
  private readonly sconcePlate = new THREE.BoxGeometry(0.26, 0.38, 0.06);
  private readonly flame = new THREE.SphereGeometry(0.1, 8, 6);
  private readonly biomeMaterials = createBiomeMaterials();
  private readonly borderMaterial = new THREE.LineBasicMaterial({ color: "#0a0a10" });
  private readonly sconceMaterial = new THREE.MeshStandardMaterial({ color: "#5a514a", roughness: 0.72 });
  private readonly flameMaterial = new THREE.MeshStandardMaterial({ color: "#ff9e44", emissive: "#ff5d1a", emissiveIntensity: 3 });
  private readonly safeDoorMaterial = new THREE.MeshStandardMaterial({ color: "#4f7fbd", emissive: "#1d3854", emissiveIntensity: 0.45 });
  private readonly partyDoorMaterial = new THREE.MeshStandardMaterial({ color: "#c05b9d", emissive: "#592249", emissiveIntensity: 0.45 });
  private readonly personalDoorMaterial = new THREE.MeshStandardMaterial({ color: "#55a66e", emissive: "#1f5030", emissiveIntensity: 0.45 });
  private readonly exitDoorMaterial = new THREE.MeshStandardMaterial({ color: "#c19346", emissive: "#59401d", emissiveIntensity: 0.45 });
  private readonly craftMaterial = new THREE.MeshStandardMaterial({ color: "#704c31", roughness: 0.9 });
  private readonly stashMaterial = new THREE.MeshStandardMaterial({ color: "#87662f", roughness: 0.72, metalness: 0.12 });
  private readonly stairMaterial = new THREE.MeshStandardMaterial({ color: "#717987", roughness: 0.88 });
  private readonly voidMaterial = new THREE.MeshStandardMaterial({ color: "#000000", roughness: 1 });
  private readonly specialTerrainMaterials: Partial<Record<number, unknown>> = {
    [TILE.CraftingTable]: this.craftMaterial,
    [TILE.Stash]: this.stashMaterial,
    [TILE.DoorPersonal]: this.personalDoorMaterial,
    [TILE.DoorParty]: this.partyDoorMaterial,
    [TILE.DoorExit]: this.exitDoorMaterial,
    [TILE.DoorSafeRoom]: this.safeDoorMaterial,
  };
  private readonly sconces: Array<{
    flame: { scale: { set(x: number, y: number, z: number): void } };
    light?: { intensity: number };
    phase: number;
  }> = [];
  constructor(private readonly world: World, scene: object & { add(...objects: unknown[]): void }, private viewRadius: ViewDistance = DEFAULT_TERRAIN_VIEW_RADIUS) {
    scene.add(this.group);
  }

  setViewRadius(viewRadius: ViewDistance): void {
    this.viewRadius = viewRadius;
  }

  rebuild(origin: { x: number; z: number }): void {
    this.group.clear();
    this.sconces.length = 0;
    this.populateTiles(origin);
  }

  update(time: number, reducedMotion = false): void {
    for (const sconce of this.sconces) {
      const flicker = reducedMotion
        ? 1
        : 0.92 + Math.sin(time * 0.009 + sconce.phase) * 0.08;
      sconce.flame.scale.set(0.9, flicker, 0.9);
      if (sconce.light) sconce.light.intensity = 8.5 + flicker * 1.5;
    }
  }

  dispose(): void {
    this.group.clear();
    this.group.removeFromParent();
    [this.cube, this.edges, this.sconcePlate, this.flame].forEach((geometry) => geometry.dispose());
    [
      this.borderMaterial,
      this.sconceMaterial,
      this.flameMaterial,
      this.safeDoorMaterial,
      this.partyDoorMaterial,
      this.personalDoorMaterial,
      this.exitDoorMaterial,
      this.craftMaterial,
      this.stashMaterial,
      this.stairMaterial,
      this.voidMaterial,
    ].forEach((material) => material.dispose());
    disposeBiomeMaterials(this.biomeMaterials);
  }

  private populateTiles(origin: { x: number; z: number }): void {
    for (let z = origin.z - this.viewRadius; z <= origin.z + this.viewRadius; z += 1) this.populateRow(origin, z);
    this.populateSconces(origin);
  }

  private populateRow(origin: { x: number; z: number }, z: number): void {
    for (let x = origin.x - this.viewRadius; x <= origin.x + this.viewRadius; x += 1) this.populateTile(x, z);
  }

  private populateTile(x: number, z: number): void {
    const rawHeight = this.world.heightAt(x, z);
    const height = Math.max(MIN_HEIGHT + 0.25, Math.min(7, rawHeight));
    const tile = this.world.tileAt(x, z);
    if (tile === TILE.Void) {
      this.addBlock({ x, z, material: this.voidMaterial, top: VOID_RENDER_TOP });
      return;
    }
    if (this.world.isWalkable(x, z)) {
      this.addWalkableTile({ x, z, height, tile });
      return;
    }
    this.addBlock({ x, z, material: this.solidMaterial({ x, z, height, tile }), top: height + 1 });
  }

  private addWalkableTile({ x, z, height, tile }: TerrainTile): void {
    const material = tile === TILE.Stairs
      ? this.stairMaterial
      : this.materialsAt({ x, z }).floors[depthIndex(height)];
    this.addBlock({ x, z, material, top: height });
  }

  private solidMaterial({ x, z, tile, height }: TerrainTile): unknown {
    const special = this.specialTerrainMaterials[tile];
    if (special) return special;
    return this.materialsAt({ x, z }).walls[depthIndex(height)];
  }

  private materialsAt({ x, z }: TerrainCell): BiomeMaterials {
    const { biome } = biomeAtWorldTile({ worldSeed: this.world.worldSeed, floor: this.world.floor, wx: x, wy: z });
    return this.biomeMaterials[biome];
  }

  private addBlock({ x, z, material, top }: TerrainBlock): void {
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
    const maxLights = environmentProfile(this.viewRadius).maxSconceLights;
    visibleSconceLocations(this.world, origin, this.viewRadius).forEach((location, index) =>
      this.addSconce(location.x, location.z, index < maxLights));
  }

  private addSconce(x: number, z: number, lit: boolean): void {
    const height = this.world.heightAt(x, z);
    const y = Math.min(height + 0.72, 1.5);
    const plate = new THREE.Mesh(this.sconcePlate, this.sconceMaterial);
    plate.position.set(x + 0.5, y, z + 1.015);
    const flame = new THREE.Mesh(this.flame, this.flameMaterial);
    flame.position.set(x + 0.5, y + 0.18, z + 1.08);
    const light = lit ? new THREE.PointLight("#ffae62", 10, 9, 2) : undefined;
    if (light) light.position.set(x + 0.5, y + 0.15, z + 0.82);
    this.group.add(plate, flame);
    if (light) this.group.add(light);
    this.sconces.push({ flame, ...(light ? { light } : {}), phase: x * 0.73 + z * 1.17 });
  }

}
