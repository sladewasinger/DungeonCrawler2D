import { describe, expect, it } from "vitest";
import { mapFrameInto } from "./frameEntityViews.js";

describe("mapFrameInto", () => {
  it("reuses one bounded output array while replacing and truncating frame values", () => {
    const output: Array<{ value: number }> = [];
    const records: Array<{ value: number }> = [];
    const identity = output;
    const recordIdentities = new Set<object>();

    for (let frame = 0; frame < 300; frame++) {
      const source = frame % 2 === 0 ? [frame, frame + 1] : [frame];
      const result = mapFrameInto({ source, out: output, records, map: (value, target) => {
        const record = target ?? { value };
        record.value = value;
        recordIdentities.add(record);
        return record;
      } });
      expect(result).toBe(identity);
      expect(result).toEqual(source.map((value) => ({ value })));
    }

    expect(recordIdentities.size).toBe(2);
    expect(output).toHaveLength(1);
    expect(mapFrameInto({ source: [], out: output, records, map: (value: number) => ({ value }) }))
      .toBe(identity);
    expect(output).toHaveLength(0);
  });
});
