import type { AdminMapEntity } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { attackStrikeHeights } from "./adminDebugAttackPosition.js";
import { attackVolumeGeometry } from "./adminDebugAttackVolumeGeometry.js";

describe("authoritative attack volume geometry", () => {
  it("projects the shared one-tile-tall volume around the strike plane", () => {
    const entity = debugEntity();
    const hitbox = entity.debug!.attacks![0]!;
    const volume = attackVolumeGeometry(entity, hitbox);

    expect(attackStrikeHeights([entity])).toEqual([3.5]);
    expect(volume?.strike.every((point) => point.z === 3.5)).toBe(true);
    expect(volume?.shell[0]?.every((point) => point.z === 3)).toBe(true);
    expect(volume?.shell[1]?.every((point) => point.z === 4)).toBe(true);
  });
});

function debugEntity(): AdminMapEntity {
  return {
    id: "dummy",
    kind: "enemy",
    x: 2,
    y: 4,
    z: 3,
    debug: {
      attacks: [{
        shape: "cone",
        direction: { x: 0, y: 1 },
        range: 2.4,
        arcCos: 0.7,
        strikeHeightOffset: 0.5,
        verticalHalfExtent: 0.5,
      }],
    },
  };
}
