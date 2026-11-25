import { WorldChunkCache } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { INITIAL_INPUT_SEND_STATE, nextReconnectDelayMs, shouldSendInputFrame } from "./worldClientHelpers.js";
import { createDefaultPlayer, predictLocalPlayerMove, reconcilePredictedPlayer } from "./worldPrediction.js";

describe("worldPrediction", () => {
  it("updates local player id and name to server assignment even within reconciliation threshold", () => {
    const local = createDefaultPlayer("local");
    const serverP2 = { ...createDefaultPlayer("p2"), name: "Adventurer", x: 0.9, y: 0.5, heldItem: "sword" };

    const reconciled = reconcilePredictedPlayer(local, serverP2);
    expect(reconciled.id).toBe("p2");
    expect(reconciled.name).toBe("Adventurer");
    expect(reconciled.heldItem).toBe("sword");
    expect(reconciled.x).toBeCloseTo(0.58, 3);
  });

  it("snaps cleanly when prediction diverges beyond threshold", () => {
    const local = createDefaultPlayer("p1");
    const serverFar = { ...createDefaultPlayer("p2"), name: "Wanderer", x: 4.0, y: 2.0 };

    const reconciled = reconcilePredictedPlayer(local, serverFar);
    expect(reconciled.id).toBe("p2");
    expect(reconciled.x).toBe(4.0);
    expect(reconciled.y).toBe(2.0);
  });

  it("preserves local 360-degree aim and facing during server snapshot reconciliation", () => {
    const aimed = { ...createDefaultPlayer("p1"), facingX: 0.6, facingY: -0.8, aimX: 0.6, aimY: -0.8 };
    const staleServer = { ...createDefaultPlayer("p1"), facingX: 0, facingY: 1, aimX: 0, aimY: 1, x: 0.6 };

    const reconciled = reconcilePredictedPlayer(aimed, staleServer);
    expect(reconciled.aimX).toBeCloseTo(0.6, 3);
    expect(reconciled.aimY).toBeCloseTo(-0.8, 3);
    expect(reconciled.facingX).toBeCloseTo(0.6, 3);
    expect(reconciled.facingY).toBeCloseTo(-0.8, 3);
  });

  it("preserves local dropped elevation and jumpZ mid-fall during snapshot reconciliation", () => {
    const midDrop = { ...createDefaultPlayer("p1"), elevation: 0, jumpZ: 0.72, jumpVz: -1.5, x: -7.5, y: -5.8 };
    const staleServer = { ...createDefaultPlayer("p1"), elevation: 1, jumpZ: 0.2, jumpVz: 0.5, x: -7.5, y: -6.1 };

    const reconciled = reconcilePredictedPlayer(midDrop, staleServer);
    expect(reconciled.elevation).toBe(0);
    expect(reconciled.jumpZ).toBeCloseTo(0.72, 3);
    expect(reconciled.jumpVz).toBeCloseTo(-1.5, 3);
  });

  it("faces movement direction when walking/sprinting without aim, and snaps on explicit aim", () => {
    const cache = new WorldChunkCache(1337);
    cache.getChunk(0, 0);
    const start = createDefaultPlayer("p1");

    const walking = predictLocalPlayerMove({ cache, player: start, nx: 0.64, ny: 0, dt: 0.05 });
    expect(walking.moving).toBe(true);
    expect(walking.sprinting).toBe(false);
    expect(walking.facingX).toBeCloseTo(1, 3);
    expect(walking.facingY).toBeCloseTo(0, 3);

    const sprinting = predictLocalPlayerMove({ cache, player: walking, nx: 1, ny: 0, dt: 0.05 });
    expect(sprinting.moving).toBe(true);
    expect(sprinting.sprinting).toBe(true);

    const attacking = predictLocalPlayerMove({ cache, player: sprinting, nx: 0.64, ny: 0, dt: 0.05, aim: { x: 0, y: -1 } });
    expect(attacking.facingX).toBeCloseTo(0, 3);
    expect(attacking.facingY).toBeCloseTo(-1, 3);
  });

  it("clamps bow-draw movement below walk speed, disables sprint, and restores sprint on release", () => {
    const cache = new WorldChunkCache(1337);
    cache.getChunk(0, 0);
    const archer = { ...createDefaultPlayer("p1"), heldItem: "bow" };

    const normalWalk = predictLocalPlayerMove({ cache, player: archer, nx: 0.5, ny: 0, dt: 0.05, bowDraw: false });
    const bowWalkSprintHeld = predictLocalPlayerMove({ cache, player: archer, nx: 1, ny: 0, dt: 0.05, bowDraw: true });
    expect(bowWalkSprintHeld.bowCharge).toBeGreaterThan(0);
    expect(bowWalkSprintHeld.sprinting).toBe(false);
    expect(bowWalkSprintHeld.x - archer.x).toBeLessThan(normalWalk.x - archer.x);

    const released = predictLocalPlayerMove({ cache, player: bowWalkSprintHeld, nx: 1, ny: 0, dt: 0.05, bowDraw: false });
    expect(released.bowCharge).toBe(0);
    expect(released.sprinting).toBe(true);
  });

  it("caps reconnect backoff delays and throttles steady-state idle/move input frames without delaying discrete actions", () => {
    expect(nextReconnectDelayMs(0)).toBe(1000);
    expect(nextReconnectDelayMs(2)).toBe(2500);
    expect(nextReconnectDelayMs(99)).toBe(5000);

    const t0 = shouldSendInputFrame({ prev: INITIAL_INPUT_SEND_STATE, nowMs: 1000, moveDir: { x: 0, y: 0 }, normAim: undefined, input: { move: { x: 0, y: 0 }, dt: 0.016 } });
    expect(t0.send).toBe(true);
    const idleDup = shouldSendInputFrame({ prev: t0.next, nowMs: 1050, moveDir: { x: 0, y: 0 }, normAim: undefined, input: { move: { x: 0, y: 0 }, dt: 0.016 } });
    expect(idleDup.send).toBe(false);
    const idleBeat = shouldSendInputFrame({ prev: t0.next, nowMs: 1210, moveDir: { x: 0, y: 0 }, normAim: undefined, input: { move: { x: 0, y: 0 }, dt: 0.016 } });
    expect(idleBeat.send).toBe(true);
    const moveStart = shouldSendInputFrame({ prev: idleBeat.next, nowMs: 1226, moveDir: { x: 1, y: 0 }, normAim: undefined, input: { move: { x: 1, y: 0 }, dt: 0.016 } });
    expect(moveStart.send).toBe(true);
    const atkEdge = shouldSendInputFrame({ prev: moveStart.next, nowMs: 1230, moveDir: { x: 1, y: 0 }, normAim: undefined, input: { move: { x: 1, y: 0 }, dt: 0.016, attack: true } });
    expect(atkEdge.send).toBe(true);
  });
});
