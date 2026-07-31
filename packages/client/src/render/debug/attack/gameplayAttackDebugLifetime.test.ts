import type { AdminMapEntity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WEDGE_FADE_MS } from "../../../vfx/combat/melee/meleeWedgeGeometry.js";
import { GameplayAttackDebugLifetime } from "./gameplayAttackDebugLifetime.js";

describe("gameplay attack debug lifetime", () => {
  it("removes an active weapon volume when the yellow wedge expires", () => {
    const lifetime = new GameplayAttackDebugLifetime();
    const entity = weaponEntity(false);

    expect(lifetime.visibleEntities([entity], 100)[0]?.debug?.attacks).toHaveLength(1);
    expect(lifetime.visibleEntities(
      [entity],
      100 + WEDGE_FADE_MS,
    )[0]?.debug?.attacks).toBeUndefined();
  });

  it("never expires an explicit persistent preview", () => {
    const lifetime = new GameplayAttackDebugLifetime();
    const entity = weaponEntity(true);

    expect(lifetime.visibleEntities(
      [entity],
      WEDGE_FADE_MS * 10,
    )[0]?.debug?.attacks).toEqual(entity.debug?.attacks);
  });
});

function weaponEntity(preview: boolean): AdminMapEntity {
  return {
    id: "player-1",
    kind: "player",
    x: 4,
    y: 5,
    z: 0,
    debug: {
      attacks: [{
        shape: "cone",
        direction: { x: 1, y: 0 },
        range: 2.4,
        arcCos: 0.7,
        strikeHeightOffset: 0.5,
        verticalHalfExtent: 0.5,
        ...(preview ? { preview: true as const } : {}),
      }],
    },
  };
}
