import { describe, expect, it } from "vitest";
import { MotionSampleBuffer } from "./motionSampleBuffer.js";

describe("MotionSampleBuffer", () => {
  it("alternates two stable records while preserving the previous frame", () => {
    const buffer = new MotionSampleBuffer();
    const identities = new Set<object>();

    for (let frame = 0; frame < 1_000; frame++) {
      const current = buffer.begin({ x: frame, y: -frame, groundHeight: frame / 10, air: frame % 2 === 0, faceX: 1 });
      identities.add(current);
      if (frame > 0) {
        expect(buffer.previous?.x).toBe(frame - 1);
        expect(buffer.previous?.groundHeight).toBe((frame - 1) / 10);
        expect(buffer.previous).not.toBe(current);
      }
      buffer.commit();
    }

    expect(identities.size).toBe(2);
  });
});
