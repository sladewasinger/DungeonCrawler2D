import { describe, expect, it } from "vitest";
import {
  emptyGenerationPreviewReplay,
  nextGenerationPreviewStage,
  previousGenerationPreviewStage,
  setGenerationPreviewTrace,
} from "./generationPreviewReplay.js";
import type { FloorGenerationTrace } from "@dc2d/engine";

const TRACE = {
  bounds: {},
  configurationFingerprint: "config",
  snapshots: ["one", "two", "three", "four", "five", "six"].map((stageId) => ({ stageId })),
} as unknown as FloorGenerationTrace;

describe("generation preview replay", () => {
  it("moves through existing immutable snapshots without generating", () => {
    let state = setGenerationPreviewTrace(emptyGenerationPreviewReplay(), TRACE);
    for (let index = 0; index < 5; index++) state = nextGenerationPreviewStage(state);
    expect(state.snapshotIndex).toBe(5);
    state = previousGenerationPreviewStage(state);
    expect(state.snapshotIndex).toBe(4);
  });

  it("clamps stage navigation to the trace bounds", () => {
    let state = setGenerationPreviewTrace(emptyGenerationPreviewReplay(), TRACE);
    state = previousGenerationPreviewStage(state);
    expect(state.snapshotIndex).toBe(0);
    for (let index = 0; index < 8; index++) state = nextGenerationPreviewStage(state);
    expect(state.snapshotIndex).toBe(5);
  });
});
