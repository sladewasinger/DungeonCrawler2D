import { describe, expect, it } from "vitest";
import {
  SpectatorRateLimits,
  createSpectatorRateWindow,
} from "./spectatorRateLimits.js";

describe("spectator rate limits", () => {
  it("retains a peer command window across a reconnect", () => {
    const limits = new SpectatorRateLimits();
    const firstSocket = createSpectatorRateWindow();
    for (let count = 0; count < 12; count++) {
      expect(limits.allowCommand("peer", firstSocket, 100)).toBe(true);
    }

    limits.release("peer", 101);
    const reconnectedSocket = createSpectatorRateWindow();

    expect(limits.allowCommand("peer", reconnectedSocket, 102)).toBe(false);
    expect(limits.allowCommand("peer", reconnectedSocket, 5_099)).toBe(false);
    expect(limits.allowCommand("peer", reconnectedSocket, 5_100)).toBe(true);
  });

  it("limits spectator hello attempts across disconnected sockets", () => {
    const limits = new SpectatorRateLimits();
    for (let count = 0; count < 4; count++) {
      expect(limits.allowStart("peer", 100)).toBe(true);
      limits.release("peer", 101);
    }

    expect(limits.allowStart("peer", 102)).toBe(false);
    expect(limits.allowStart("peer", 5_099)).toBe(false);
    expect(limits.allowStart("peer", 5_100)).toBe(true);
  });

  it("retains target-change cooldown state across a reconnect", () => {
    const limits = new SpectatorRateLimits();

    limits.recordTargetChange("peer", 100);
    limits.release("peer", 101);

    expect(limits.lastTargetChangeAt("peer", 102)).toBe(100);
  });
});
