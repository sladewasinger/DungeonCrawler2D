import { expect } from "vitest";
import { GRAVITY, JUMP_VELOCITY } from "../../../core/constants.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  containsPoint,
  type MiniBossArenaSite,
} from "./miniBossArena.js";

const PREVIOUS_PLAYABLE_AREA = 49;

export function assertEnlargedArena(
  world: World,
  site: MiniBossArenaSite,
): void {
  expect(boundsArea(site.interior)).toBeGreaterThanOrEqual(
    PREVIOUS_PLAYABLE_AREA * 2,
  );
  expect(site.gates.length).toBeGreaterThanOrEqual(1);
  expect(site.gates.length).toBeLessThanOrEqual(3);
  expect(site.platforms).toHaveLength(2);
  assertValidGates(world, site);
  assertJumpablePlatforms(world, site);
}

function boundsArea(bounds: MiniBossArenaSite["bounds"]): number {
  return (bounds.x1 - bounds.x0 + 1) * (bounds.y1 - bounds.y0 + 1);
}

function assertValidGates(world: World, site: MiniBossArenaSite): void {
  const positions = new Set(site.gates.map(({ x, y }) => `${x},${y}`));
  expect(positions.size).toBe(site.gates.length);
  for (const gate of site.gates) {
    expect(onArenaBoundary(site, gate.x, gate.y)).toBe(true);
    expect(containsPoint(site.interior, gate.inside.x, gate.inside.y)).toBe(true);
    expect(containsPoint(site.bounds, gate.outside.x, gate.outside.y)).toBe(false);
    assertGateApproach(world, site, gate.outside);
  }
}

function assertGateApproach(
  world: World,
  site: MiniBossArenaSite,
  outside: { readonly x: number; readonly y: number },
): void {
  const x = Math.floor(outside.x);
  const y = Math.floor(outside.y);
  expect(Math.floor(x / CHUNK_SIZE)).toBe(site.chunk.cx);
  expect(Math.floor(y / CHUNK_SIZE)).toBe(site.chunk.cy);
  expect(world.tileAt(x, y)).toBe(TILE.Floor);
  expect(world.featureAt(x, y)).toBe(TILE.Floor);
  expect(world.heightAt(x, y)).toBe(0);
  expect(world.isWalkable(x, y)).toBe(true);
}

function onArenaBoundary(
  site: MiniBossArenaSite,
  x: number,
  y: number,
): boolean {
  return x === site.bounds.x0 || x === site.bounds.x1 ||
    y === site.bounds.y0 || y === site.bounds.y1;
}

function assertJumpablePlatforms(world: World, site: MiniBossArenaSite): void {
  const positions = new Set(site.platforms.map(({ x, y }) => `${x},${y}`));
  expect(positions.size).toBe(2);
  const reserved = reservedEncounterCells(site);
  const jumpApex = (JUMP_VELOCITY ** 2) / (2 * GRAVITY);
  for (const platform of site.platforms) {
    expect(platform.height).toBeGreaterThan(0);
    expect(platform.height).toBeLessThanOrEqual(jumpApex);
    expect(platform.screenDepthTiles).toBeGreaterThanOrEqual(
      Math.round(platform.height) + 1,
    );
    assertPlatformCells({ world, site, platform, reserved });
    expect(hasFlatApproach(world, platform.x, platform.y)).toBe(true);
  }
}

interface PlatformCellAssertion {
  readonly world: World;
  readonly site: MiniBossArenaSite;
  readonly platform: MiniBossArenaSite["platforms"][number];
  readonly reserved: ReadonlySet<string>;
}

function assertPlatformCells(input: PlatformCellAssertion): void {
  const { world, site, platform, reserved } = input;
  for (let dy = 0; dy < platform.screenDepthTiles; dy++) {
    const y = platform.y + dy;
    expect(containsPoint(site.interior, platform.x + 0.5, y + 0.5))
      .toBe(true);
    expect(reserved.has(`${platform.x},${y}`)).toBe(false);
    expect(world.tileAt(platform.x, y)).toBe(TILE.Floor);
    expect(world.featureAt(platform.x, y)).toBe(TILE.Floor);
    expect(world.heightAt(platform.x, y)).toBe(platform.height);
    expect(world.isWalkable(platform.x, y)).toBe(true);
  }
}

function reservedEncounterCells(site: MiniBossArenaSite): Set<string> {
  const cells = [
    site.center,
    { x: site.center.x - 2, y: site.center.y },
    { x: site.center.x + 2, y: site.center.y },
    { x: site.center.x, y: site.center.y + 2 },
    ...site.gates.map(({ inside }) => ({
      x: Math.floor(inside.x),
      y: Math.floor(inside.y),
    })),
  ];
  return new Set(cells.map(({ x, y }) => `${x},${y}`));
}

function hasFlatApproach(world: World, x: number, y: number): boolean {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ].some((point) =>
    world.isWalkable(point.x, point.y) &&
    world.tileAt(point.x, point.y) === TILE.Floor &&
    world.heightAt(point.x, point.y) === 0
  );
}
