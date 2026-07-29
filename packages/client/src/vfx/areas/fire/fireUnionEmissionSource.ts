import { groundToScreen } from "../../../render/entities/geometry/worldToScreen.js";
import { hashSeed } from "../../../render/lighting/core/lightSource.js";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import { AREA_FIRE_FIELD } from "../presentation/areaVisualStyle.js";
import type { FireFieldComponent } from "./fireFieldTopology.js";

interface MutablePoint {
  x: number;
  y: number;
}

export interface FireEmissionRegion {
  readonly maximumX: number;
  readonly maximumY: number;
  readonly minimumX: number;
  readonly minimumY: number;
  readonly tileX: number;
  readonly tileY: number;
}

export interface FireEmissionSnapshot {
  readonly groundHeight: number;
  readonly regions: readonly FireEmissionRegion[];
}

export interface FireEmissionSample {
  readonly index: number;
  readonly phase: number;
  readonly snapshot: FireEmissionSnapshot;
}

/**
 * Phaser-compatible random-zone source. Its domain changes in place so live
 * particles retain their trajectory while the next particles follow new terrain.
 */
export class FireUnionEmissionSource {
  private snapshot: FireEmissionSnapshot | null = null;
  private emissionIndex = 0;
  private initialized = false;

  sync(component: FireFieldComponent, phaseKey: string): void {
    this.snapshot = createFireEmissionSnapshot(component);
    if (this.initialized) return;
    this.emissionIndex = hashSeed(phaseKey);
    this.initialized = true;
  }

  getRandomPoint(point: MutablePoint): void {
    const snapshot = this.snapshot;
    if (!snapshot) throw new Error("fire emission source used before placement");
    const sample = sampleFireEmission({
      snapshot,
      index: this.emissionIndex++,
      phase: 0,
    });
    const screen = groundToScreen(
      sample.x,
      sample.y,
      snapshot.groundHeight,
    );
    point.x = screen.x;
    point.y = screen.y;
  }
}

export function createFireEmissionSnapshot(
  component: FireFieldComponent,
): FireEmissionSnapshot {
  const tiles = [...component.tiles].sort(sortTiles);
  const groundHeight = tiles[0]?.groundHeight;
  if (groundHeight === undefined) throw new Error("fire field has no tiles");
  const tileKeys = new Set(tiles.map(tileKey));
  const edgeInput = {
    inset: AREA_FIRE_FIELD.maskInsetPx / SCREEN_TILE_PX,
    tileKeys,
  };
  const regions = tiles.map((tile) => Object.freeze(
    fireEmissionRegion(tile, edgeInput),
  ));
  return Object.freeze({
    groundHeight,
    regions: Object.freeze(regions),
  });
}

export function sampleFireEmission(input: FireEmissionSample): {
  readonly x: number;
  readonly y: number;
} {
  const { snapshot } = input;
  if (snapshot.regions.length === 1) return centeredFireEmission(snapshot);
  const sequence = input.index + input.phase;
  const region = snapshot.regions[sequence % snapshot.regions.length]!;
  const round = Math.floor(sequence / snapshot.regions.length);
  return {
    x: interpolate(region.minimumX, region.maximumX, radicalInverse(round + 1, 2)),
    y: interpolate(region.minimumY, region.maximumY, radicalInverse(round + 1, 3)),
  };
}

function fireEmissionRegion(
  tile: FireFieldComponent["tiles"][number],
  edgeInput: FireEmissionEdgeInput,
): FireEmissionRegion {
  return {
    tileX: tile.x,
    tileY: tile.y,
    minimumX: tile.x - 0.5 + edgeInset(tile.x - 1, tile.y, edgeInput),
    maximumX: tile.x + 0.5 - edgeInset(tile.x + 1, tile.y, edgeInput),
    minimumY: tile.y - 0.5 + edgeInset(tile.x, tile.y - 1, edgeInput),
    maximumY: tile.y + 0.5 - edgeInset(tile.x, tile.y + 1, edgeInput),
  };
}

interface FireEmissionEdgeInput {
  readonly inset: number;
  readonly tileKeys: ReadonlySet<string>;
}

function edgeInset(
  neighborX: number,
  neighborY: number,
  input: FireEmissionEdgeInput,
): number {
  return input.tileKeys.has(`${neighborX},${neighborY}`) ? 0 : input.inset;
}

function centeredFireEmission(
  snapshot: FireEmissionSnapshot,
): { readonly x: number; readonly y: number } {
  const region = snapshot.regions[0]!;
  return { x: region.tileX, y: region.tileY };
}

function radicalInverse(index: number, base: number): number {
  let denominator = base;
  let result = 0;
  while (index > 0) {
    result += (index % base) / denominator;
    index = Math.floor(index / base);
    denominator *= base;
  }
  return result;
}

function interpolate(minimum: number, maximum: number, unit: number): number {
  return minimum + (maximum - minimum) * unit;
}

function sortTiles(
  left: FireFieldComponent["tiles"][number],
  right: FireFieldComponent["tiles"][number],
): number {
  return left.y - right.y || left.x - right.x;
}

function tileKey(tile: FireFieldComponent["tiles"][number]): string {
  return `${tile.x},${tile.y}`;
}
