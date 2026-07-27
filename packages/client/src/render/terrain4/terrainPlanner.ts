import type { Point } from "../view/viewTransform.js";
import { viewTileToWorld, worldTileToView } from "../view/viewTransform.js";
import type { ViewOrientation } from "../view/viewOrientation.js";

/** The only two terrain-plane values understood by the height-map renderer. */
export const TERRAIN4 = {
  Floor: "floor",
  Void: "void",
} as const;

/** Ignore sub-pixel noise so generated Float32 heights do not create hairline faces. */
export const TERRAIN4_HEIGHT_EPSILON = 0.01;

export type Terrain4Kind = (typeof TERRAIN4)[keyof typeof TERRAIN4];

/** Authored art that lives on the floor plane without becoming terrain. */
export const TERRAIN4_FEATURES = {
  Stairs: "stairs",
  Door: "door",
  Brazier: "brazier",
} as const;

export type Terrain4FeatureKind = (typeof TERRAIN4_FEATURES)[keyof typeof TERRAIN4_FEATURES];

/** A small, engine-agnostic read surface. Features are optional so the planner
 * remains useful for the minimal Floor/Void geometry tests and future worlds. */
export interface Terrain4Source {
  terrainAt(worldX: number, worldY: number): Terrain4Kind;
  heightAt(worldX: number, worldY: number): number;
  featureAt?(worldX: number, worldY: number): Terrain4FeatureKind | null;
}

export interface Terrain4Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Terrain4PlanOptions {
  /** World-space tiles whose geometry belongs to this plan. */
  readonly bounds: Terrain4Rect;
  /** Settled camera direction. Geometry is emitted in this direction's view space. */
  readonly orientation: ViewOrientation;
  /**
   * Extra cells the source promises to make available around `bounds`.
   * The planner never emits those cells, but it may read them to resolve an
   * edge at a chunk seam. One cell is enough for the current south-face rule.
   */
  readonly seamApron?: number;
}

export interface Terrain4Vertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A consistently wound, view-space rectangle. */
export type Terrain4QuadVertices = readonly [
  Terrain4Vertex,
  Terrain4Vertex,
  Terrain4Vertex,
  Terrain4Vertex,
];

interface Terrain4QuadBase {
  readonly worldTile: Point;
  readonly viewTile: Point;
  readonly vertices: Terrain4QuadVertices;
}

export interface Terrain4FloorQuad extends Terrain4QuadBase {
  readonly kind: "floor";
  readonly height: number;
}

export interface Terrain4VoidQuad extends Terrain4QuadBase {
  readonly kind: "void";
}

export interface Terrain4FeatureQuad extends Terrain4QuadBase {
  readonly kind: "feature";
  readonly feature: Terrain4FeatureKind;
  readonly height: number;
}

export interface Terrain4SouthFaceQuad extends Terrain4QuadBase {
  readonly kind: "south-face";
  readonly topHeight: number;
  readonly bottomHeight: number;
}

/** Renderer-ready geometry, separated so material selection never needs a Phaser type. */
export interface Terrain4Batches {
  readonly floors: readonly Terrain4FloorQuad[];
  readonly voids: readonly Terrain4VoidQuad[];
  readonly features: readonly Terrain4FeatureQuad[];
  readonly southFaces: readonly Terrain4SouthFaceQuad[];
}

export interface Terrain4Plan {
  readonly bounds: Terrain4Rect;
  readonly sampleBounds: Terrain4Rect;
  readonly orientation: ViewOrientation;
  readonly batches: Terrain4Batches;
}

/**
 * Produces the height-map renderer's minimal geometry in view space.
 *
 * Void produces only a flat cap quad. A vertical face is similarly strict:
 * both cells must be finite Floor surfaces, and only a positive drop toward
 * view-south emits a face. Mapping the south neighbor through view space makes
 * the same rule work for all four cardinal camera orientations.
 */
export function planTerrain4(source: Terrain4Source, options: Terrain4PlanOptions): Terrain4Plan {
  assertRect(options.bounds, "bounds");
  const seamApron = options.seamApron ?? 1;
  if (!Number.isInteger(seamApron) || seamApron < 0) {
    throw new Error("seamApron must be a non-negative integer");
  }

  const floors: Terrain4FloorQuad[] = [];
  const voids: Terrain4VoidQuad[] = [];
  const features: Terrain4FeatureQuad[] = [];
  const southFaces: Terrain4SouthFaceQuad[] = [];
  const { bounds, orientation } = options;

  for (let worldY = bounds.y; worldY < bounds.y + bounds.height; worldY += 1) {
    for (let worldX = bounds.x; worldX < bounds.x + bounds.width; worldX += 1) {
      appendTileGeometry(source, { x: worldX, y: worldY }, orientation, floors, voids, features, southFaces);
    }
  }

  return {
    bounds,
    sampleBounds: expandRect(bounds, seamApron),
    orientation,
    batches: { floors, voids, features, southFaces },
  };
}

function appendTileGeometry(
  source: Terrain4Source,
  worldTile: Point,
  orientation: ViewOrientation,
  floors: Terrain4FloorQuad[],
  voids: Terrain4VoidQuad[],
  features: Terrain4FeatureQuad[],
  southFaces: Terrain4SouthFaceQuad[],
): void {
  const terrain = source.terrainAt(worldTile.x, worldTile.y);
  const viewTile = worldTileToView(worldTile, orientation);
  if (terrain === TERRAIN4.Void) {
    voids.push({ kind: "void", worldTile, viewTile, vertices: topQuad(viewTile, 0) });
    return;
  }
  if (terrain !== TERRAIN4.Floor) return;
  const height = finiteHeight(source, worldTile);
  const feature = source.featureAt?.(worldTile.x, worldTile.y) ?? null;
  if (feature) {
    features.push({ kind: "feature", feature, worldTile, viewTile, height, vertices: topQuad(viewTile, height) });
  } else {
    floors.push({ kind: "floor", worldTile, viewTile, height, vertices: topQuad(viewTile, height) });
  }

  // Express the adjacent screen-south cell in view space, then map it back to
  // world space. This is intentionally not `worldY + 1` at 90/180/270.
  const southWorld = viewTileToWorld({ x: viewTile.x, y: viewTile.y + 1 }, orientation);
  if (source.terrainAt(southWorld.x, southWorld.y) !== TERRAIN4.Floor) return;
  const southHeight = finiteHeight(source, southWorld);
  if (height - southHeight <= TERRAIN4_HEIGHT_EPSILON) return;
  southFaces.push({
    kind: "south-face", worldTile, viewTile, topHeight: height, bottomHeight: southHeight,
    vertices: southFaceQuad(viewTile, height, southHeight),
  });
}

function finiteHeight(source: Terrain4Source, tile: Point): number {
  const height = source.heightAt(tile.x, tile.y);
  if (!Number.isFinite(height)) {
    throw new Error(`Floor at (${tile.x}, ${tile.y}) has a non-finite height`);
  }
  return height;
}

function topQuad(tile: Point, height: number): Terrain4QuadVertices {
  return [
    { x: tile.x, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y, z: height },
    { x: tile.x + 1, y: tile.y + 1, z: height },
    { x: tile.x, y: tile.y + 1, z: height },
  ];
}

function southFaceQuad(tile: Point, topHeight: number, bottomHeight: number): Terrain4QuadVertices {
  const southY = tile.y + 1;
  return [
    { x: tile.x, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: topHeight },
    { x: tile.x + 1, y: southY, z: bottomHeight },
    { x: tile.x, y: southY, z: bottomHeight },
  ];
}

function expandRect(rect: Terrain4Rect, apron: number): Terrain4Rect {
  return {
    x: rect.x - apron,
    y: rect.y - apron,
    width: rect.width + apron * 2,
    height: rect.height + apron * 2,
  };
}

function assertRect(rect: Terrain4Rect, name: string): void {
  if (!Number.isInteger(rect.x) || !Number.isInteger(rect.y) ||
      !Number.isInteger(rect.width) || !Number.isInteger(rect.height) ||
      rect.width < 0 || rect.height < 0) {
    throw new Error(`${name} must have integer coordinates and non-negative dimensions`);
  }
}
