import type { AreaDef } from "../types.js";

export interface AreaLayer {
  defId: string;
  remaining: number;
  steps: number;
  sourceId?: string;
}

export interface AreaCell {
  layers: AreaLayer[];
}

export interface AreaPosition {
  x: number;
  y: number;
}

export interface AreaPlacement extends AreaPosition {
  defId: string;
  steps: number;
  sourceId?: string;
}

export interface AreaSpawn extends AreaPosition {
  defId: string;
  radius: number;
  sourceId?: string;
}

export interface AreaIgnition extends AreaPosition {
  fireDefId: string;
  fuelTag?: string;
  sourceId?: string;
}

export interface AreaSpreadInput {
  k: string;
  layer: AreaLayer;
  dt: number;
  rng: () => number;
}

export interface AreaSpreadCandidateInput extends AreaPosition {
  buoyancy: AreaDef["buoyancy"];
  ontoAreaTag: string | undefined;
}

export interface AreaContact {
  statusId: string;
  sourceId?: string;
}

export type AreaPlacementResult =
  | { readonly applied: true }
  | {
    readonly applied: false;
    readonly reason:
      | "unknown-area"
      | "blocked-tile"
      | "lower-priority-channel"
      | "equal-priority-channel"
      | "reaction-conflict";
    readonly detail?: string;
  };

export interface AreaTileState {
  x: number;
  y: number;
  defId: string | null;
  layers?: string[];
}
