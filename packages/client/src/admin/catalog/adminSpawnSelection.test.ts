import { describe, expect, it } from "vitest";
import type { AdminPalette } from "@dc2d/engine";
import {
  emptyAdminSpawnSelections,
  selectionForAdminSpawnKind,
  validAdminSpawnSelection,
  withAdminSpawnDefinition,
} from "./adminSpawnSelection.js";

const ORC = "orc-warrior";
const TORCH = "torch";
const PALETTE: AdminPalette = {
  enemies: ["goblin", "slime", ORC],
  items: [TORCH, "water-flask"],
  weapons: ["sword", "hammer"],
  pets: ["pet-dino-tard"],
};

describe("admin spawn selection", () => {
  it("keeps a selected definition that belongs to the active type", () => {
    expect(validAdminSpawnSelection(PALETTE, {
      kind: "enemy",
      defId: ORC,
    })).toEqual({ kind: "enemy", defId: ORC });
  });

  it("selects the first valid definition after switching types", () => {
    expect(validAdminSpawnSelection(PALETTE, {
      kind: "weapon",
      defId: ORC,
    })).toEqual({ kind: "weapon", defId: "sword" });
  });

  it("defaults the enemy tab to slime when it is available", () => {
    expect(validAdminSpawnSelection(PALETTE, {
      kind: "enemy",
      defId: "",
    })).toEqual({ kind: "enemy", defId: "slime" });
  });

  it("falls back to the first enemy when slime is unavailable", () => {
    expect(validAdminSpawnSelection({ ...PALETTE, enemies: ["goblin", ORC] }, {
      kind: "enemy",
      defId: "",
    })).toEqual({ kind: "enemy", defId: "goblin" });
  });

  it("uses an empty definition when a type has no spawnable content", () => {
    expect(validAdminSpawnSelection({ ...PALETTE, items: [] }, {
      kind: "item",
      defId: TORCH,
    })).toEqual({ kind: "item", defId: "" });
  });

  it("remembers a card selection for each type while changing tabs", () => {
    const enemySelection = { kind: "enemy", defId: ORC } as const;
    const itemSelection = { kind: "item", defId: TORCH } as const;
    const selections = withAdminSpawnDefinition(
      withAdminSpawnDefinition(emptyAdminSpawnSelections(), enemySelection),
      itemSelection,
    );

    expect(selectionForAdminSpawnKind(selections, "enemy")).toEqual(enemySelection);
    expect(selectionForAdminSpawnKind(selections, "item")).toEqual(itemSelection);
  });

  it("keeps pet selection separate from the other placement tabs", () => {
    const selection = { kind: "pet", defId: "pet-dino-tard" } as const;
    const selections = withAdminSpawnDefinition(emptyAdminSpawnSelections(), selection);

    expect(selectionForAdminSpawnKind(selections, "pet")).toEqual(selection);
  });
});
