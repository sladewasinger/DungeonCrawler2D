// Pure regression coverage for the elevated-projectile pointer seam. The server
// remains authoritative; these cases only prove which two local directions are
// produced before the existing attack intent is sent.
import { describe, expect, it } from "vitest";
import { worldToView, type ViewOrientation } from "../../../render/view/index.js";
import {
  findProjectileReflectionAim,
  type ReflectionProjectileSnapshot,
} from "./projectileReflectionAim.js";

const PLAYER = { x: 10, y: 10 };
const SPIT: ReflectionProjectileSnapshot = {
  id: "spit-a",
  x: 12,
  y: 10,
  z: 1,
};

describe("projectile reflection pointer aim", () => {
  it.each([0, 90, 180, 270] as const)(
    "reconciles the rendered center at orientation %d while preserving visible aim",
    (orientation) => {
      const pointerView = renderedCenter(SPIT, orientation);
      const result = findProjectileReflectionAim({
        player: PLAYER,
        pointerView,
        orientation,
        weaponReach: 2,
        projectiles: [SPIT],
      });

      expect(result?.projectileId).toBe(SPIT.id);
      expect(result?.networkDirection).toEqual({ x: 2, y: 0 });
      expect(result?.presentationDirection).not.toEqual(result?.networkDirection);
    },
  );

  it("ignores oil, item, and out-of-reach projectiles", () => {
    const pointerView = renderedCenter(SPIT, 0);
    const result = findProjectileReflectionAim({
      player: PLAYER,
      pointerView,
      orientation: 0,
      weaponReach: 2,
      projectiles: [
        { ...SPIT, id: "oil", defId: "pitchbloom-oil-lob" },
        { ...SPIT, id: "item", defId: "bomb" },
        { ...SPIT, id: "far", x: 12.4 },
      ],
    });

    expect(result).toBeUndefined();
  });

  it("chooses the nearest rendered center and breaks exact ties by entity id", () => {
    const result = findProjectileReflectionAim({
      player: PLAYER,
      pointerView: { x: 12.05, y: 9 },
      orientation: 0,
      weaponReach: 2,
      projectiles: [
        { ...SPIT, id: "spit-z" },
        { ...SPIT, id: "spit-a" },
        { ...SPIT, id: "spit-far", x: 12.2 },
      ],
    });

    expect(result?.projectileId).toBe("spit-a");
  });
});

function renderedCenter(
  projectile: ReflectionProjectileSnapshot,
  orientation: ViewOrientation,
): { x: number; y: number } {
  const view = worldToView(projectile, orientation);
  return { x: view.x, y: view.y - projectile.z };
}
