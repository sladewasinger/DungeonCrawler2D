import { DEFAULT_FLOOR_CAP } from "@dc2d/engine";
import { EditableWorld } from "./EditableWorld.js";

export interface EditorProblemMap {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly exportJson: () => string;
}

function raisedPlatformProjectionJson(): string {
  const world = new EditableWorld();
  world.paintFloorHeightAt(5, 5, 3, DEFAULT_FLOOR_CAP);
  return JSON.stringify(world.serialize());
}

function floorHeightRunJson(): string {
  const world = new EditableWorld();
  for (let x = 5; x <= 9; x++) world.paintFloorHeightAt(x, 9, x - 4, DEFAULT_FLOOR_CAP);
  return JSON.stringify(world.serialize());
}

function steppedPitJson(): string {
  const world = new EditableWorld();
  world.paintFloorHeightAt(8, 8, -1, DEFAULT_FLOOR_CAP);
  world.paintFloorHeightAt(8, 9, -2, DEFAULT_FLOOR_CAP);
  return JSON.stringify(world.serialize());
}

function towerOcclusionJson(): string {
  const world = new EditableWorld();
  world.paintFloorHeightAt(10, 10, 4, DEFAULT_FLOOR_CAP);
  world.paintFloorHeightAt(10, 8, 1, DEFAULT_FLOOR_CAP);
  world.paintFloorHeightAt(10, 9, 1, DEFAULT_FLOOR_CAP);
  return JSON.stringify(world.serialize());
}

export const EDITOR_PROBLEM_MAPS: readonly EditorProblemMap[] = [
  {
    id: "raised-platform-projection",
    label: "load platform repro",
    description: "A height-3 floor for checking projected faces and picking.",
    exportJson: raisedPlatformProjectionJson,
  },
  {
    id: "floor-height-run",
    label: "load z1-z5 repro",
    description: "A one-cell-deep z1 through z5 floor run for checking derived wall faces.",
    exportJson: floorHeightRunJson,
  },
  {
    id: "stepped-pit",
    label: "load stepped pit repro",
    description: "A z0 to z-1 to z-2 pit for checking stepped pit-face shading.",
    exportJson: steppedPitJson,
  },
  {
    id: "tower-occlusion",
    label: "load tower occlusion repro",
    description: "A z4 tower with z1 caps immediately north; those caps must be hidden by the tower body.",
    exportJson: towerOcclusionJson,
  },
];

export function problemMapById(id: string): EditorProblemMap {
  const map = EDITOR_PROBLEM_MAPS.find((candidate) => candidate.id === id);
  if (!map) throw new Error(`Unknown editor problem map: ${id}`);
  return map;
}
