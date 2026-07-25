/** Bounded deterministic dust motes that add depth without gameplay state. */
import * as THREE from "three";

const MAX_MOTES = 64;
const SPREAD = 18;

const unitHash = (index: number, salt: number): number => {
  const value = Math.sin(index * 91.17 + salt * 37.31) * 43758.5453;
  return value - Math.floor(value);
};

export class ThreeAmbientMotes {
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(MAX_MOTES * 3);
  private readonly material = new THREE.PointsMaterial({
    color: "#b8c5dc",
    size: 0.035,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly points = new THREE.Points(this.geometry, this.material);
  private count = MAX_MOTES;

  constructor(scene: { add(...objects: unknown[]): void }) {
    this.seed();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setDrawRange(0, this.count);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setCount(count: number): void {
    this.count = Math.max(0, Math.min(MAX_MOTES, Math.floor(count)));
    this.geometry.setDrawRange(0, this.count);
  }

  update(
    timeMs: number,
    center: { x: number; y: number; z: number },
    reducedMotion: boolean,
  ): void {
    const time = reducedMotion ? 0 : timeMs / 1000;
    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      this.positions[offset] = center.x + (unitHash(index, 1) - 0.5) * SPREAD;
      this.positions[offset + 1] = center.y - 0.4 + unitHash(index, 2) * 2.4 +
        Math.sin(time * 0.35 + index) * 0.08;
      this.positions[offset + 2] = center.z + (unitHash(index, 3) - 0.5) * SPREAD;
    }
    const attribute = this.geometry.getAttribute("position");
    attribute.needsUpdate = true;
  }

  dispose(): void {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private seed(): void {
    for (let index = 0; index < MAX_MOTES; index += 1) {
      const offset = index * 3;
      this.positions[offset] = (unitHash(index, 1) - 0.5) * SPREAD;
      this.positions[offset + 1] = unitHash(index, 2) * 2;
      this.positions[offset + 2] = (unitHash(index, 3) - 0.5) * SPREAD;
    }
  }
}
