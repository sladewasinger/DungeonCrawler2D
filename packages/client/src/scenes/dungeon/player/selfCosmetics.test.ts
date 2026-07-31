import { describe, expect, it } from "vitest";
import { Connection } from "../../../net/connection/connection.js";
import {
  assistedSelfAimFacing,
  consumeRespawnGrace,
  createSelfCosmeticsState,
  endSelfGrace,
  isSelfAttacking,
  startSelfGrace,
  triggerSelfAttack,
  updateSelfFacing,
} from "./selfCosmetics.js";

describe("updateSelfFacing", () => {
  it("adopts a nonzero move direction", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, { moveX: -1, moveY: 0 });
    expect(state.faceX).toBe(-1);
    expect(state.faceY).toBe(0);
  });

  it("holds the last facing while idle", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, { moveX: -1, moveY: 1 });
    updateSelfFacing(state, { moveX: 0, moveY: 0 });
    expect(state.faceX).toBe(-1);
    expect(state.faceY).toBe(1);
  });

  it("adopts pointer-facing input even while the movement axes are idle", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, { moveX: 0, moveY: 0, faceX: -1, faceY: 0 });
    expect(state.faceX).toBe(-1);
    expect(state.spriteFaceX).toBe(-1);
  });

  it("keeps the last horizontal sprite facing during vertical movement", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, { moveX: -1, moveY: 0 });
    updateSelfFacing(state, { moveX: 0, moveY: -1 });
    expect(state.spriteFaceX).toBe(-1);
    expect(state.faceY).toBe(-1);
  });

  it("forfeits an active grace ring on real movement input", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    updateSelfFacing(state, { moveX: 1, moveY: 0 });
    expect(state.graceUntilMs).toBe(0);
  });

  it("forfeits an active grace ring on jump alone, even with neutral move axes", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    updateSelfFacing(state, { moveX: 0, moveY: 0, jump: true });
    expect(state.graceUntilMs).toBe(0);
  });

  it("does not forfeit grace on neutral coasting (no move, no jump)", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    updateSelfFacing(state, { moveX: 0, moveY: 0 });
    expect(state.graceUntilMs).toBeGreaterThan(1000);
  });
});

describe("attack pulse", () => {
  it("reads as attacking immediately after trigger, and not once it elapses", () => {
    const state = createSelfCosmeticsState();
    triggerSelfAttack(state, { nowMs: 1000, dirX: 1, dirY: 0 });
    expect(isSelfAttacking(state, 1000)).toBe(true);
    expect(isSelfAttacking(state, 1159)).toBe(true);
    expect(isSelfAttacking(state, 1160)).toBe(false);
  });

  it("defaults to not attacking before any trigger", () => {
    const state = createSelfCosmeticsState();
    expect(isSelfAttacking(state, 0)).toBe(false);
  });

  it("records the swing's exact aim direction, for the wedge/weapon-sweep telegraph to match", () => {
    const state = createSelfCosmeticsState();
    triggerSelfAttack(state, { nowMs: 1000, dirX: 0, dirY: -1 });
    expect(state.attackDirX).toBe(0);
    expect(state.attackDirY).toBe(-1);
  });

  it("presents movement-facing until an assisted attack captures a target", () => {
    const state = createSelfCosmeticsState();
    updateSelfFacing(state, { moveX: 1, moveY: 0 });
    expect(assistedSelfAimFacing(state, 900)).toEqual({ x: 1, y: 0 });
    triggerSelfAttack(state, { nowMs: 1000, dirX: -1, dirY: 0 });
    expect(assistedSelfAimFacing(state, 1000)).toEqual({ x: -1, y: 0 });
  });
});

describe("spawn-grace shield ring state (fade math itself lives in vfx/graceRing.ts)", () => {
  it("defaults to inactive", () => {
    const state = createSelfCosmeticsState();
    expect(state.graceUntilMs).toBe(0);
  });

  it("startSelfGrace sets an absolute expiry in the future", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    expect(state.graceUntilMs).toBeGreaterThan(1000);
  });

  it("endSelfGrace forfeits the ring immediately", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    endSelfGrace(state);
    expect(state.graceUntilMs).toBe(0);
  });

  it("restarting grace mid-fade resets the expiry forward from the new start", () => {
    const state = createSelfCosmeticsState();
    startSelfGrace(state, 1000);
    const first = state.graceUntilMs;
    startSelfGrace(state, 1500);
    expect(state.graceUntilMs).toBeGreaterThan(first);
  });
});

describe("consumeRespawnGrace", () => {
  function freshConnection(): Connection {
    return new Connection("wss://example.test", "Tester", "client-1");
  }

  it("starts the grace ring and clears the flag when a respawn was detected", () => {
    const conn = freshConnection();
    conn.justRespawned = true;
    const state = createSelfCosmeticsState();

    consumeRespawnGrace(conn, state, 1000);

    expect(conn.justRespawned).toBe(false);
    expect(state.graceUntilMs).toBeGreaterThan(1000);
  });

  it("is a no-op when no respawn was detected this frame", () => {
    const conn = freshConnection();
    const state = createSelfCosmeticsState();

    consumeRespawnGrace(conn, state, 1000);

    expect(state.graceUntilMs).toBe(0);
  });
});
