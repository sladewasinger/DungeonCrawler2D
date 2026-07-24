/** Covers coordinate conversion and reconnect presentation through the public actor update path. */
import { describe, expect, it, vi } from "vitest";
import { remoteActorPose } from "./remoteActorPose.js";
import { ThreeRemoteActors } from "./ThreeRemoteActors.js";
import type { DisconnectedActorLabel } from "./ThreeRemoteActorReconnectPresentation.js";

describe("remote actor rendering", () => {
  it("maps engine x/y/z and facing into Three.js space", () => {
    expect(remoteActorPose({ x: 4, y: -3, z: 1.25, snap: { faceX: 1, faceY: 0 } }))
      .toMatchObject({ x: 4, y: 1.25, z: -3 });
    expect(remoteActorPose({ x: 4, y: -3, z: 1.25, snap: { faceX: 1, faceY: 0 } }).yaw)
      .toBeCloseTo(Math.PI / 2);
  });

  it("shows and clears reconnect presentation through ThreeRemoteActors.update", () => {
    const color = { value: "", set(value: string) { this.value = value; } };
    const emissive = { value: "", set(value: string) { this.value = value; } };
    const node = {
      isMesh: true,
      material: { color, emissive, emissiveIntensity: 1, clone: () => ({ color, emissive, emissiveIntensity: 1 }) },
      userData: {},
    };
    const label = {
      visible: false,
      parent: {},
      position: { set: vi.fn() },
      scale: { set: vi.fn() },
    } as unknown as DisconnectedActorLabel;
    const object = {
      position: { set: vi.fn() },
      rotation: { y: 0 },
      traverse: (visit: (value: typeof node) => void) => visit(node),
      add: vi.fn(),
    };
    const instance = Object.create(ThreeRemoteActors.prototype) as {
      actors: Map<string, unknown>;
      update(connection: unknown, elapsed: number): void;
    };
    instance.actors = new Map([["p", { kind: "player", object, disconnected: false, disconnectedLabel: label }]]);
    const remote = (disconnected: boolean) => ({ id: "p", x: 1, y: 2, z: 0, snap: { kind: "player", disconnected } });
    instance.update({ interpolated: () => [remote(true)] }, 0.016);
    expect({ color: color.value, label: label.visible }).toEqual({ color: "#55555a", label: true });
    instance.update({ interpolated: () => [remote(false)] }, 0.016);
    expect({ color: color.value, label: label.visible }).toEqual({ color: "#ffffff", label: false });
  });
});
