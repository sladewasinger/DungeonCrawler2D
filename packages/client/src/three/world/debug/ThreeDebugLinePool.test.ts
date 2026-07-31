import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ThreeDebugLinePool } from "./ThreeDebugLinePool.js";

const FIRST_LINE = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
];

describe("Three debug line pool", () => {
  it("maps simulation x/y/z to Three x/z/y without flattening elevation", () => {
    const group = new THREE.Group();
    const pool = new ThreeDebugLinePool(group, 1);

    pool.beginFrame();
    pool.line([
      { x: 2, y: 3, z: 4 },
      { x: 5, y: 6, z: 7 },
    ], 0xf7c55c, 0);
    pool.endFrame();

    const line = group.children[0] as InstanceType<typeof THREE.Line>;
    const positions = line.geometry.getAttribute("position");
    expect([positions.getX(0), positions.getY(0), positions.getZ(0)])
      .toEqual([2, 4, 3]);
    expect([positions.getX(1), positions.getY(1), positions.getZ(1)])
      .toEqual([5, 7, 6]);
    pool.dispose();
  });

  it("reuses bounded line objects and shared color materials across frames", () => {
    const group = new THREE.Group();
    const pool = new ThreeDebugLinePool(group, 2);

    pool.beginFrame();
    pool.line(FIRST_LINE, 0xf3727d);
    pool.endFrame();
    const firstLine = group.children[0] as InstanceType<typeof THREE.Line>;
    const firstMaterial = firstLine.material;

    pool.beginFrame();
    pool.line([...FIRST_LINE].reverse(), 0xf3727d);
    pool.line(FIRST_LINE, 0xf3727d);
    pool.line(FIRST_LINE, 0xf3727d);
    pool.endFrame();

    expect(group.children).toHaveLength(2);
    expect(group.children[0]).toBe(firstLine);
    expect(firstLine.material).toBe(firstMaterial);
    const secondLine = group.children[1] as InstanceType<typeof THREE.Line>;
    expect(secondLine.material).toBe(firstMaterial);
    pool.dispose();
    expect(group.children).toHaveLength(0);
  });
});
