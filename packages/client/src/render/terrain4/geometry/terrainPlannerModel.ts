import type { Point } from "../../view/transform/viewTransform.js";
import type { ViewOrientation } from "../../view/orientation/viewOrientation.js";

export const TERRAIN4 = { Floor: "floor", Void: "void" } as const;
export const TERRAIN4_HEIGHT_EPSILON = 0.01;
export const TERRAIN4_FLOOR_EDGE_MIN_DROP = 0.1;
export type Terrain4Kind = (typeof TERRAIN4)[keyof typeof TERRAIN4];

export const TERRAIN4_FEATURES = { Stairs: "stairs", Door: "door", Brazier: "brazier" } as const;
export type Terrain4FeatureKind = (typeof TERRAIN4_FEATURES)[keyof typeof TERRAIN4_FEATURES];
export const TERRAIN4_CLIFFS = { Middle: "middle", Corner: "corner" } as const;
export type Terrain4CliffKind = (typeof TERRAIN4_CLIFFS)[keyof typeof TERRAIN4_CLIFFS];
export type Terrain4CliffSide = "north" | "south" | "east" | "west";
export type Terrain4QuarterTurn = 0 | 90 | 180 | 270;
export const TERRAIN4_PROPS = { CraftingTable: "crafting-table", Stash: "stash" } as const;
export type Terrain4PropKind = (typeof TERRAIN4_PROPS)[keyof typeof TERRAIN4_PROPS];

export interface Terrain4Source {
  terrainAt(worldX: number, worldY: number): Terrain4Kind;
  heightAt(worldX: number, worldY: number): number;
  featureAt?(worldX: number, worldY: number): Terrain4FeatureKind | null;
  propAt?(worldX: number, worldY: number): Terrain4PropKind | null;
}
export interface Terrain4Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface Terrain4PlanOptions {
  readonly bounds: Terrain4Rect;
  readonly orientation: ViewOrientation;
  readonly seamApron?: number;
}
export interface Terrain4Vertex { readonly x: number; readonly y: number; readonly z: number; }
export type Terrain4QuadVertices = readonly [Terrain4Vertex, Terrain4Vertex, Terrain4Vertex, Terrain4Vertex];
interface Terrain4QuadBase { readonly worldTile: Point; readonly viewTile: Point; readonly vertices: Terrain4QuadVertices; }
export interface Terrain4FloorQuad extends Terrain4QuadBase { readonly kind: "floor"; readonly height: number; }
export interface Terrain4VoidQuad extends Terrain4QuadBase { readonly kind: "void"; }
export interface Terrain4FeatureQuad extends Terrain4QuadBase { readonly kind: "feature"; readonly feature: Terrain4FeatureKind; readonly height: number; }
export interface Terrain4PropQuad extends Terrain4QuadBase { readonly kind: "prop"; readonly prop: Terrain4PropKind; readonly height: number; }
export interface Terrain4SouthFaceQuad extends Terrain4QuadBase {
  readonly kind: "south-face"; readonly topHeight: number; readonly bottomHeight: number;
  readonly stairWall?: boolean; readonly southNeighborIsStair?: boolean;
}
export interface Terrain4CliffEdgeQuad extends Terrain4QuadBase {
  readonly kind: "cliff-edge"; readonly cliff: Terrain4CliffKind; readonly rotation: Terrain4QuarterTurn;
  readonly height: number; readonly sides: readonly Terrain4CliffSide[];
}
export interface Terrain4AOMask { readonly north: boolean; readonly south: boolean; readonly east: boolean; readonly west: boolean; readonly nw: boolean; readonly ne: boolean; readonly sw: boolean; readonly se: boolean; }
export interface Terrain4AOQuad extends Terrain4QuadBase { readonly kind: "ao"; readonly height: number; readonly mask: Terrain4AOMask; }
export interface Terrain4Batches {
  readonly floors: readonly Terrain4FloorQuad[]; readonly voids: readonly Terrain4VoidQuad[];
  readonly features: readonly Terrain4FeatureQuad[]; readonly props: readonly Terrain4PropQuad[];
  readonly southFaces: readonly Terrain4SouthFaceQuad[]; readonly cliffEdges: readonly Terrain4CliffEdgeQuad[];
  readonly ao: readonly Terrain4AOQuad[];
}
export interface Terrain4Plan { readonly bounds: Terrain4Rect; readonly sampleBounds: Terrain4Rect; readonly orientation: ViewOrientation; readonly batches: Terrain4Batches; }
