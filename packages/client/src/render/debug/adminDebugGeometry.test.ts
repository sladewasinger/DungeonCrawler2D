import type { AdminMapEntity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  activeGuardArea,
  hitboxWedge,
  boxOutline,
  boxWireframe,
  combatHurtbox,
  currentLineOfSight,
  navigationPath,
  wedgeOutline,
} from "./adminDebugGeometry.js";

describe("admin debug geometry", () => {
  it("keeps combat boxes and wedges in authoritative world-tile units", () => {
    const entity = debugEntity();
    const hitbox = entity.debug!.attacks![0]!;

    expect(combatHurtbox(entity)).toEqual({
      center: { x: 10.5, y: 20.5, z: 0 },
      halfWidth: 0.4,
      halfDepth: 0.3,
      height: 1.5,
      bottomOffset: 0.05,
    });
    expect(hitbox.shape).toBe("cone");
    if (hitbox.shape !== "cone") throw new Error("expected cone hitbox");
    expect(hitboxWedge(entity, hitbox)).toMatchObject({
      center: { x: 10.5, y: 20.5, z: 0 },
      direction: { x: 1, y: 0 },
      radius: 1.6,
      arcCos: 0.7,
    });
  });

  it("keeps the exact padded upright hurtbox volume", () => {
    const entity = { ...debugEntity(), z: 2.25 };
    const hurtbox = combatHurtbox(entity);
    if (!hurtbox) throw new Error("expected hurtbox");

    const points = boxOutline(hurtbox);
    expect(points).toHaveLength(5);
    expect(points.every((point) => point.z === 2.2)).toBe(true);
    expect(points).toEqual([
      { x: 10.1, y: 20.2, z: 2.2 },
      { x: 10.9, y: 20.2, z: 2.2 },
      { x: 10.9, y: 20.8, z: 2.2 },
      { x: 10.1, y: 20.8, z: 2.2 },
      { x: 10.1, y: 20.2, z: 2.2 },
    ]);
    const wireframe = boxWireframe(hurtbox);
    expect(wireframe).toHaveLength(6);
    expect(wireframe[1]?.every((point) => point.z === 3.7)).toBe(true);
  });

  it("projects only the distinct live sight, guard, and navigation fields", () => {
    const entity = debugEntity();
    const guard = activeGuardArea(entity);

    expect(currentLineOfSight(entity)).toEqual({ x: 13.5, y: 20.5, z: 0 });
    expect(navigationPath(entity)).toEqual([
      { x: 11.5, y: 20.5, z: 0 },
      { x: 12.5, y: 20.5, z: 0 },
    ]);
    expect(guard).toMatchObject({ radius: 0.68, arcCos: 0.7 });
    expect(guard && wedgeOutline(guard, 2)).toHaveLength(5);
  });
});

function debugEntity(): AdminMapEntity {
  return {
    id: "enemy-1",
    kind: "enemy",
    x: 10.5,
    y: 20.5,
    z: 0,
    debug: {
      hurtbox: {
        halfWidth: 0.4,
        halfDepth: 0.3,
        height: 1.5,
        bottomOffset: 0.05,
      },
      attacks: [{
        shape: "cone",
        direction: { x: 1, y: 0 },
        range: 1.6,
        arcCos: 0.7,
      }],
      guard: {
        direction: { x: 1, y: 0 },
        radius: 0.68,
        arcCos: 0.7,
      },
      lineOfSight: { x: 13.5, y: 20.5, z: 0 },
      navigation: {
        path: [
          { x: 11.5, y: 20.5, z: 0 },
          { x: 12.5, y: 20.5, z: 0 },
        ],
      },
    },
  };
}
