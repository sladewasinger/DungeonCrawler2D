import { describe, expect, it } from "vitest";
import { DEFAULT_FLOOR_GENERATION_CONFIG } from "@dc2d/engine";
import {
  approvedConfigFromNormalized,
  defaultGenerationPreviewDraft,
  serializeGenerationPreviewRequest,
} from "./generationPreviewControls.js";
import { GENERATION_PREVIEW_CONTROL_TEXT } from "./generationPreviewControlDom.js";
import { PREVIEW_TERRITORY_CATALOG } from "./territoryCatalog.js";

describe("generation preview controls", () => {
  it("derives approved controls from the normalized engine config", () => {
    const draft = defaultGenerationPreviewDraft(42);
    const normalized = approvedConfigFromNormalized(DEFAULT_FLOOR_GENERATION_CONFIG);
    expect(draft).toEqual({ seed: 42, floor: 1, config: normalized });
  });

  it("serializes only the editor request surface", () => {
    const draft = defaultGenerationPreviewDraft(42);
    const request = serializeGenerationPreviewRequest({
      ...draft,
      floor: 3,
      config: { ...draft.config, roomTargetCount: draft.config.roomTargetCount + 1 },
    });
    expect(request.worldSeed).toBe(42);
    expect(request.floor).toBe(3);
    expect(request.config).toMatchObject({
      roomTargetCount: draft.config.roomTargetCount + 1,
      roomSize: draft.config.roomSize,
      roomMinWidth: draft.config.roomSize - draft.config.roomSizeVariation * 3,
      roomMaxWidth: draft.config.roomSize + draft.config.roomSizeVariation * 3,
    });
    expect(request.config).not.toHaveProperty("roomAttemptBudget");
    expect(request.config).not.toHaveProperty("mazeCorridorWidth");
    expect(request.config).not.toHaveProperty("ordinaryCorridorWidthMin");
    expect(request.config).not.toHaveProperty("ordinaryCorridorWidthMax");
    expect(request.config).not.toHaveProperty("roomEntranceWidth");
    expect(request.config).not.toHaveProperty("targetLoopCount");
    expect(Object.keys(request.config ?? {})).not.toContain("minimumBiomeArea");
    expect(Object.keys(request.config ?? {})).not.toContain("generatorVersion");
  });

  it("keeps low-level generation knobs out of the authored draft contract", () => {
    const keys = Object.keys(defaultGenerationPreviewDraft().config);
    expect(keys).toEqual([
      "roomTargetCount", "roomSize", "roomSizeVariation", "mazeDensity",
      "connectorDensity", "minimumLoopPathSaving", "deadEndRemovalFraction",
      "territoryLayoutDensity", "territoryRoster",
    ]);
  });

  it("keeps territory choices on the authored catalog boundary", () => {
    const ids = PREVIEW_TERRITORY_CATALOG.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PREVIEW_TERRITORY_CATALOG.every(({ description }) => description.length > 0)).toBe(true);
    expect(defaultGenerationPreviewDraft().config.territoryRoster.every((id) => ids.includes(id))).toBe(true);
  });

  it("uses descriptive topology labels and help instead of opaque feel knobs", () => {
    const labels = Object.values(GENERATION_PREVIEW_CONTROL_TEXT).map(({ label }) => label);
    const help = Object.values(GENERATION_PREVIEW_CONTROL_TEXT).map(({ help: text }) => text);
    expect(labels).not.toEqual(expect.arrayContaining(["Loop feel", "Connector feel", "Dead-end feel"]));
    expect(help.every((text) => text.length > 20)).toBe(true);
  });
});
