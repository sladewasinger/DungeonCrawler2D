import type { AreaDef } from "../effects/types.js";

export interface AreaTile {
  defId: string;
  remaining: number;
  steps: number;
}

export interface AreaPosition {
  x: number;
  y: number;
}

export interface AreaPlacement extends AreaPosition {
  defId: string;
  steps: number;
}

export interface AreaSpawn extends AreaPosition {
  defId: string;
  radius: number;
}

export interface AreaMeetingInput extends AreaPlacement {
  def: AreaDef;
  existing: AreaTile;
}

export interface AreaMeetingApplication extends AreaPlacement {
  rule: AreaMeet;
  existingDefId: string;
}

export interface AreaSpreadInput {
  k: string;
  tile: AreaTile;
  dt: number;
  rng: () => number;
}

export interface AreaSpreadCandidateInput extends AreaPosition {
  buoyancy: AreaDef["buoyancy"];
  ontoAreaTag: string | undefined;
}

export interface AreaMeet {
  a: string;
  b: string;
  becomes: string | null;
}

export const AREA_MEETS: readonly AreaMeet[] = [
  { a: "fire", b: "wet", becomes: "area-steam" },
  { a: "fire", b: "oil", becomes: "area-fire" },
  { a: "fire", b: "steam", becomes: "area-steam" },
];
