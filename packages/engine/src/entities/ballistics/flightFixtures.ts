import type { WorldView } from "../../world/core/types.js";

export interface BallisticFixture {
  readonly name: string;
  readonly from: { x: number; y: number; z: number };
  readonly target: { x: number; y: number };
  readonly world: WorldView;
}

function fixtureWorld(
  groundAt: (x: number, y: number) => number,
  isWalkable: (x: number, y: number) => boolean = () => true,
): WorldView {
  return {
    isWalkable,
    heightAt: (x, y) => groundAt(x + 0.5, y + 0.5),
    groundAt,
    stairHeightAt: () => null,
  };
}

export const ballisticFixtures: readonly BallisticFixture[] = [
  {
    name: "flat",
    from: { x: 1.5, y: 1.5, z: 1 },
    target: { x: 5.5, y: 1.5 },
    world: fixtureWorld(() => 0),
  },
  {
    name: "raised",
    from: { x: 1.5, y: 1.5, z: 1 },
    target: { x: 4.5, y: 1.5 },
    world: fixtureWorld((x) => x >= 4 ? 2 : 0),
  },
  {
    name: "lowered",
    from: { x: 1.5, y: 1.5, z: 3 },
    target: { x: 4.5, y: 1.5 },
    world: fixtureWorld((x) => x >= 2 ? -1.5 : 2),
  },
  {
    name: "near",
    from: { x: 1.5, y: 1.5, z: 1.25 },
    target: { x: 1.7, y: 1.65 },
    world: fixtureWorld(() => 0),
  },
  {
    name: "maximum range",
    from: { x: 1.5, y: 1.5, z: 1 },
    target: { x: 30, y: 1.5 },
    world: fixtureWorld(() => 0),
  },
  {
    name: "diagonal",
    from: { x: 1.5, y: 1.5, z: 1.5 },
    target: { x: 5.5, y: 4.5 },
    world: fixtureWorld(() => 0),
  },
  {
    name: "blocking terrain",
    from: { x: 1.5, y: 1.5, z: 1 },
    target: { x: 5.5, y: 1.5 },
    world: fixtureWorld(() => 0, (x, y) => x !== 3 || y !== 1),
  },
];
