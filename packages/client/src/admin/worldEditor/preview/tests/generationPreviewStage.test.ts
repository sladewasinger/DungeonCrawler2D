import { describe, expect, it } from "vitest";
import { generationPreviewStageStatus } from "../generationPreviewStage.js";
import { stagedHoverResult } from "./generationPreviewControllerSupport.js";

describe("generation preview stage status", () => {
  it("names the baseline and reports native-cell plus metadata deltas", () => {
    const trace = stagedHoverResult().trace;
    expect(generationPreviewStageStatus({ trace, snapshotIndex: 0 })).toContain("baseline");
    const changed = generationPreviewStageStatus({ trace, snapshotIndex: 1 });
    expect(changed).toContain("1 changed cell");
    expect(changed).toContain("rooms Δ1");
  });
});
