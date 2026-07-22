/** Covers the network-to-Three coordinate conversion for remote player models. */
import { describe, expect, it } from "vitest";
import { remoteActorPose } from "./remoteActorPose.js";

describe("remoteActorPose", () => {
  it("maps engine x/y/z and facing into Three.js space", () => {
    expect(remoteActorPose({ x: 4, y: -3, z: 1.25, snap: { faceX: 1, faceY: 0 } })).toMatchObject({ x: 4, y: 1.25, z: -3 });
    expect(remoteActorPose({ x: 4, y: -3, z: 1.25, snap: { faceX: 1, faceY: 0 } }).yaw).toBeCloseTo(Math.PI / 2);
  });
});
