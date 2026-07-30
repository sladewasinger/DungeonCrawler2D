import type { EntitySnapshot } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import { VIEW_ORIENTATIONS } from "../../../view/orientation/viewOrientation.js";
import { viewToWorld } from "../../../view/transform/viewTransform.js";
import {
  isEntityInViewport,
  shouldPresentEntity,
  type PresentationViewport,
} from "./entityPresentationVisibility.js";

const VIEWPORT: PresentationViewport = {
  x: 0,
  y: 0,
  width: 10 * SCREEN_TILE_PX,
  height: 10 * SCREEN_TILE_PX,
};

function entityAtView({
  id,
  viewX,
  viewY,
  orientation,
  z = 0,
}: {
  readonly id: string;
  readonly viewX: number;
  readonly viewY: number;
  readonly orientation: (typeof VIEW_ORIENTATIONS)[number];
  readonly z?: number;
}
): Pick<EntitySnapshot, "id" | "x" | "y" | "z"> {
  const world = viewToWorld({ x: viewX, y: viewY }, orientation);
  return { id, x: world.x, y: world.y, z };
}

describe("entity presentation visibility", () => {
  it("projects the center consistently through every camera orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      expect(isEntityInViewport({
        entity: entityAtView({ id: `center-${orientation}`, viewX: 5, viewY: 5, orientation }),
        viewport: VIEWPORT,
        orientation,
        marginTiles: 0,
      })).toBe(true);
    }
  });

  it("includes exact margin edges and excludes entities just beyond them", () => {
    const marginTiles = 2;
    expect(isEntityInViewport({
      entity: entityAtView({ id: "edge", viewX: 12, viewY: 5, orientation: 0 }),
      viewport: VIEWPORT,
      orientation: 0,
      marginTiles,
    })).toBe(true);
    expect(isEntityInViewport({
      entity: entityAtView({ id: "outside", viewX: 12.01, viewY: 5, orientation: 0 }),
      viewport: VIEWPORT,
      orientation: 0,
      marginTiles,
    })).toBe(false);
  });

  it("uses the absolute height offset on the screen vertical axis", () => {
    const low = entityAtView({ id: "low", viewX: 5, viewY: 11, orientation: 0 });
    const raised = entityAtView({ id: "raised", viewX: 5, viewY: 11, orientation: 0, z: 2 });
    expect(isEntityInViewport({ entity: low, viewport: VIEWPORT, orientation: 0, marginTiles: 0 })).toBe(false);
    expect(isEntityInViewport({ entity: raised, viewport: VIEWPORT, orientation: 0, marginTiles: 0 })).toBe(true);
  });

  it("applies the same cull decision to every network entity kind", () => {
    const kinds: EntitySnapshot["kind"][] = ["player", "enemy", "pet", "item", "projectile", "torch"];
    for (const kind of kinds) {
      const entity = { ...entityAtView({ id: kind, viewX: 20, viewY: 5, orientation: 0 }), kind };
      expect(shouldPresentEntity({
        entity,
        viewport: VIEWPORT,
        orientation: 0,
        marginTiles: 0,
      })).toBe(false);
    }
  });

  it("retains active interaction targets and can be disabled for rooms", () => {
    const farAway = entityAtView({ id: "target", viewX: 30, viewY: 30, orientation: 180 });
    expect(shouldPresentEntity({
      entity: farAway,
      viewport: VIEWPORT,
      orientation: 180,
      marginTiles: 0,
      retainedIds: new Set(["target"]),
    })).toBe(true);
    expect(shouldPresentEntity({
      entity: farAway,
      viewport: VIEWPORT,
      orientation: 180,
      marginTiles: 0,
      enabled: false,
    })).toBe(true);
  });

  it("culls remote presentation outside the toon terrain field", () => {
    const entity = entityAtView({
      id: "hidden-enemy",
      viewX: 5,
      viewY: 5,
      orientation: 0,
    });
    const terrainVisibility = { isWorldPositionVisible: () => false };
    expect(shouldPresentEntity({
      entity,
      viewport: VIEWPORT,
      orientation: 0,
      marginTiles: 0,
      terrainVisibility,
    })).toBe(false);
    expect(shouldPresentEntity({
      entity,
      viewport: VIEWPORT,
      orientation: 0,
      marginTiles: 0,
      retainedIds: new Set([entity.id]),
      terrainVisibility,
    })).toBe(true);
  });
});
