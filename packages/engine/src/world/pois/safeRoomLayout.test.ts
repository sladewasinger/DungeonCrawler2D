/** Unit tests for Sanctuary Town Hub fixtures and Sanctuary containment [REQ-P9-04]. */
import { PropKind } from "@dc2d/contracts";
import { describe, expect, it } from "vitest";
import { isInSanctuary } from "../../combat/combatRules.js";
import { generateChunk } from "../chunkGenerator.js";
import { OUTER_SAFE_ROOM_PROPS, SPAWN_HUB_FIXTURES } from "./safeRoomLayout.js";

describe("[REQ-P9-04] Floor 1 Sanctuary Hub & outer Safe Room fixtures", () => {
  it("stamps all Sanctuary Hub NPCs, Bounty Board, Stash, Hearth, and Workbench inside spawn sanctuary", () => {
    const chunks = [
      generateChunk(1337, 0, 0),
      generateChunk(1337, -1, 0),
      generateChunk(1337, 0, -1),
      generateChunk(1337, -1, -1),
    ];
    const allProps = chunks.flatMap((c) => c.props);
    const required = [
      PropKind.Campfire,
      PropKind.Workbench,
      PropKind.StashChest,
      PropKind.BountyBoard,
      PropKind.NpcGuide,
      PropKind.NpcMerchant,
      PropKind.NpcBlacksmith,
    ];
    for (const kind of required) {
      const found = allProps.find((p) => p.kind === kind);
      expect(found, `missing hub prop ${kind}`).toBeDefined();
      if (found) expect(isInSanctuary(found.x, found.y)).toBe(true);
    }
  });

  it("keeps Workbench > 2.8 tiles from initial spawn (0.5, 0.5) and includes walkable outer safe-room kit", () => {
    const wb = SPAWN_HUB_FIXTURES.find((f) => f.kind === PropKind.Workbench);
    expect(wb).toBeDefined();
    if (wb) expect(Math.hypot(wb.x - 0.5, wb.y - 0.5)).toBeGreaterThan(2.8);
    expect(OUTER_SAFE_ROOM_PROPS.map((p) => p.kind)).toEqual(
      expect.arrayContaining([PropKind.Campfire, PropKind.Workbench, PropKind.StashChest, PropKind.NpcMerchant]),
    );
  });
});
