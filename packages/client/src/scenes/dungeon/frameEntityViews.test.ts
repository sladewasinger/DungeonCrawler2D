import { describe, expect, it } from "vitest";
import { mapFrameInto } from "./frameEntityViews.js";

describe("mapFrameInto", () => {
  it("reuses one bounded output array while replacing and truncating frame values", () => {
    const output: Array<{ value: number }> = [];
    const identity = output;

    for (let frame = 0; frame < 300; frame++) {
      const source = frame % 2 === 0 ? [frame, frame + 1] : [frame];
      const result = mapFrameInto(source, output, (value) => ({ value }));
      expect(result).toBe(identity);
      expect(result).toEqual(source.map((value) => ({ value })));
    }

    expect(output).toHaveLength(1);
    expect(mapFrameInto([], output, (value: number) => ({ value }))).toBe(identity);
    expect(output).toHaveLength(0);
  });
});
