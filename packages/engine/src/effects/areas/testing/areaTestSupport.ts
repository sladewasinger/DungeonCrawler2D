import { buildContentRegistry } from "../../types.js";
import type { AreaWorld } from "../system.js";
import {
  AREA_TEST_DEFINITIONS,
  STEAM_AREA_ID,
} from "./areaTestDefinitions.js";
export {
  FIRE_AREA_ID,
  OIL_AREA_ID,
  SMOKE_AREA_ID,
  STEAM_AREA_ID,
  VODKA_AREA_ID,
  WET_AREA_ID,
} from "./areaTestDefinitions.js";

function minimalStatus(id: string) {
  return {
    id,
    name: id,
    kind: "debuff" as const,
    tags: [] as string[],
    duration: 5,
    stacking: "refresh" as const,
  };
}

const DEFAULT_REACTIONS = [
  {
    id: "fire-burns-oil",
    priority: 20,
    when: ["fire", "oil"],
    actions: [{ op: "rate_consume", tag: "oil", perSecond: 3 }],
  },
  {
    id: "fire-and-wet-become-steam",
    priority: 30,
    when: ["fire", "wet"],
    actions: [
      { op: "remove", tag: "fire" },
      { op: "remove", tag: "wet" },
      { op: "add", area: STEAM_AREA_ID, sourceFromTag: "fire" },
    ],
  },
  {
    id: "steam-extinguishes-fire",
    priority: 10,
    when: ["fire", "steam"],
    actions: [{ op: "remove", tag: "fire" }],
  },
];

export function buildAreaTestContent(
  areaReactions: unknown[] = DEFAULT_REACTIONS,
) {
  return buildContentRegistry({
    statuses: ["on-fire", "wet", "oiled", "poisoned"].map(minimalStatus),
    rules: [],
    areaReactions,
    areas: AREA_TEST_DEFINITIONS,
    items: [],
    enemies: [],
    recipes: [],
  });
}

export const areaTestContent = buildAreaTestContent();

export function flatAreaWorld(options: {
  heightFn?: (x: number, y: number) => number;
  sanctuary?: (x: number, y: number) => boolean;
} = {}): AreaWorld {
  return {
    isWalkable: () => true,
    heightAt: (x, y) => options.heightFn?.(x, y) ?? 0,
    groundAt: (x, y) => options.heightFn?.(Math.floor(x), Math.floor(y)) ?? 0,
    isSanctuary: (x, y) => options.sanctuary?.(x, y) ?? false,
    stairHeightAt: () => null,
  };
}
