import * as THREE from "three";
import type { ThreeEntityPresentation } from "./threeEntityPresentation.js";
import { threeGroundedDepth } from "./threeGroundedDepth.js";

export function createThreeLootChest(
  presentation: ThreeEntityPresentation,
) {
  const group = new THREE.Group();
  const depth = threeGroundedDepth(0, presentation.elevation);
  const material = new THREE.MeshStandardMaterial({
    color: presentation.color,
    emissive: presentation.emissive,
    roughness: 0.78,
    depthTest: depth.depthTest,
    depthWrite: depth.depthWrite,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.56), material);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.6), material.clone());
  lid.position.y = 0.3;
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.64, 0.62),
    new THREE.MeshStandardMaterial({
      color: "#b58b48",
      metalness: 0.55,
      depthTest: depth.depthTest,
      depthWrite: depth.depthWrite,
    }),
  );
  band.position.y = 0.08;
  group.add(base, lid, band);
  return group;
}
