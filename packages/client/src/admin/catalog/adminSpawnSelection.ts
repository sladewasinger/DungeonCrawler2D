import type { AdminPalette } from "@dc2d/engine";
import type { AdminSpawnSelection } from "../adminSpectatorSurface.js";
import {
  type AdminSpawnKind,
  paletteDefinitions,
} from "../adminPageSupport.js";

export type AdminSpawnSelections = Readonly<Record<AdminSpawnKind, string>>;

const DEFAULT_ENEMY_DEFINITION_ID = "slime";

export function emptyAdminSpawnSelections(): AdminSpawnSelections {
  return { enemy: "", item: "", weapon: "", pet: "" };
}

export function selectionForAdminSpawnKind(
  selections: AdminSpawnSelections,
  kind: AdminSpawnKind,
): AdminSpawnSelection {
  return { kind, defId: selections[kind] };
}

export function withAdminSpawnDefinition(
  selections: AdminSpawnSelections,
  selection: AdminSpawnSelection,
): AdminSpawnSelections {
  return { ...selections, [selection.kind]: selection.defId };
}

export function validAdminSpawnSelection(
  palette: AdminPalette,
  selection: AdminSpawnSelection,
): AdminSpawnSelection {
  const definitions = paletteDefinitions(palette, selection.kind);
  if (definitions.includes(selection.defId)) return selection;
  return { kind: selection.kind, defId: defaultDefinitionId(selection.kind, definitions) };
}

function defaultDefinitionId(
  kind: AdminSpawnKind,
  definitions: readonly string[],
): string {
  if (kind === "enemy" && definitions.includes(DEFAULT_ENEMY_DEFINITION_ID)) {
    return DEFAULT_ENEMY_DEFINITION_ID;
  }
  return definitions[0] ?? "";
}
