import type { Point } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";

export const TERRAIN_KINDS = { Floor: "floor", Void: "void" } as const;
export const TERRAIN_HEIGHT_EPSILON = 0.01;
export const TERRAIN_FLOOR_EDGE_MIN_DROP = 0.1;
export type TerrainKind = (typeof TERRAIN_KINDS)[keyof typeof TERRAIN_KINDS];

export const TERRAIN_FEATURES = { Stairs: "stairs", Door: "door", Brazier: "brazier" } as const;
export type TerrainFeatureKind = (typeof TERRAIN_FEATURES)[keyof typeof TERRAIN_FEATURES];
export const TERRAIN_CLIFFS = { Middle: "middle", Corner: "corner" } as const;
export type TerrainCliffKind = (typeof TERRAIN_CLIFFS)[keyof typeof TERRAIN_CLIFFS];
export type TerrainCliffSide = "north" | "south" | "east" | "west";
export type TerrainQuarterTurn = 0 | 90 | 180 | 270;
export const TERRAIN_PROPS = { CraftingTable: "crafting-table", Stash: "stash" } as const;
export type TerrainPropKind = (typeof TERRAIN_PROPS)[keyof typeof TERRAIN_PROPS];

export interface TerrainSource {
  /** Explicit server-selected mode; standalone tools must choose deliberately. */
  readonly voidTerrain: boolean;
  terrainAt(worldX: number, worldY: number): TerrainKind;
  heightAt(worldX: number, worldY: number): number;
  featureAt?(worldX: number, worldY: number): TerrainFeatureKind | null;
  propAt?(worldX: number, worldY: number): TerrainPropKind | null;
}
export interface TerrainRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface TerrainPlanOptions {
  readonly bounds: TerrainRect;
  readonly orientation: ViewOrientation;
  readonly seamApron?: number;
}
export interface TerrainVertex { readonly x: number; readonly y: number; readonly z: number; }
export type TerrainQuadVertices = readonly [TerrainVertex, TerrainVertex, TerrainVertex, TerrainVertex];
interface TerrainQuadBase { readonly worldTile: Point; readonly viewTile: Point; readonly vertices: TerrainQuadVertices; }
export interface TerrainFloorQuad extends TerrainQuadBase { readonly kind: "floor"; readonly height: number; }
export interface TerrainVoidQuad extends TerrainQuadBase { readonly kind: "void"; }
export interface TerrainFeatureQuad extends TerrainQuadBase { readonly kind: "feature"; readonly feature: TerrainFeatureKind; readonly height: number; }
export interface TerrainPropQuad extends TerrainQuadBase { readonly kind: "prop"; readonly prop: TerrainPropKind; readonly height: number; }
export interface TerrainSouthFaceQuad extends TerrainQuadBase {
  readonly kind: "south-face"; readonly topHeight: number; readonly bottomHeight: number;
  readonly stairWall?: boolean; readonly southNeighborIsStair?: boolean; readonly voidWall?: boolean;
}
export interface TerrainCliffEdgeQuad extends TerrainQuadBase {
  readonly kind: "cliff-edge"; readonly cliff: TerrainCliffKind; readonly rotation: TerrainQuarterTurn;
  readonly height: number; readonly sides: readonly TerrainCliffSide[]; readonly voidBoundary?: boolean;
}
export interface TerrainAOMask { readonly north: boolean; readonly south: boolean; readonly east: boolean; readonly west: boolean; readonly nw: boolean; readonly ne: boolean; readonly sw: boolean; readonly se: boolean; }
export interface TerrainAOQuad extends TerrainQuadBase { readonly kind: "ao"; readonly height: number; readonly mask: TerrainAOMask; }
export interface TerrainBatches {
  readonly floors: readonly TerrainFloorQuad[]; readonly voids: readonly TerrainVoidQuad[];
  readonly features: readonly TerrainFeatureQuad[]; readonly props: readonly TerrainPropQuad[];
  readonly southFaces: readonly TerrainSouthFaceQuad[]; readonly cliffEdges: readonly TerrainCliffEdgeQuad[];
  readonly ao: readonly TerrainAOQuad[];
}
export interface TerrainPlan { readonly bounds: TerrainRect; readonly sampleBounds: TerrainRect; readonly orientation: ViewOrientation; readonly batches: TerrainBatches; }
