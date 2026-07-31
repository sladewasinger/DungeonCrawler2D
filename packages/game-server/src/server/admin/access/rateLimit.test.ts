import { describe, expect, it } from "vitest";
import { normalizedPeerAddress } from "./peerAddress.js";
import { AdminAccessLimiter } from "./rateLimit.js";

describe("admin access limiter", () => {
  it("limits failed authentication across connections from one peer", () => {
    const limiter = limiterFor(new FakeClock());
    const peer = "203.0.113.10";

    expect(recordFailedAuthentication(limiter, peer)).toBe(false);
    expect(recordFailedAuthentication(limiter, peer)).toBe(false);
    expect(recordFailedAuthentication(limiter, peer)).toBe(true);
    expect(limiter.canAttemptAuthentication(peer)).toBe(false);
  });

  it("expires failed authentication state after its window", () => {
    const clock = new FakeClock();
    const limiter = limiterFor(clock);
    const peer = "203.0.113.11";

    recordFailedAuthentication(limiter, peer);
    recordFailedAuthentication(limiter, peer);
    recordFailedAuthentication(limiter, peer);
    clock.advance(10 * 60_000);

    expect(limiter.canAttemptAuthentication(peer)).toBe(true);
    expect(recordFailedAuthentication(limiter, peer)).toBe(false);
  });

  it("keeps failed authentication budgets isolated by peer", () => {
    const limiter = limiterFor(new FakeClock());
    const limitedPeer = "203.0.113.12";
    const otherPeer = "203.0.113.13";

    recordFailedAuthentication(limiter, limitedPeer);
    recordFailedAuthentication(limiter, limitedPeer);
    recordFailedAuthentication(limiter, limitedPeer);

    expect(limiter.canAttemptAuthentication(limitedPeer)).toBe(false);
    expect(limiter.canAttemptAuthentication(otherPeer)).toBe(true);
  });

  it("shares the command budget across authenticated connections from one peer", () => {
    const limiter = limiterFor(new FakeClock());
    const peer = "203.0.113.14";

    for (let index = 0; index < 40; index++) {
      expect(limiter.acceptAuthenticatedCommand(peer)).toBe(true);
    }

    expect(limiter.acceptAuthenticatedCommand(peer)).toBe(false);
  });

  it("bounds session resume attempts before opaque keys are resolved", () => {
    const limiter = limiterFor(new FakeClock());
    const peer = "203.0.113.16";

    for (let index = 0; index < 8; index++) {
      expect(limiter.acceptSessionResume(peer)).toBe(true);
    }

    expect(limiter.acceptSessionResume(peer)).toBe(false);
  });

  it("bounds tracked peer entries by evicting the least recently created key", () => {
    const limiter = new AdminAccessLimiter({
      now: new FakeClock().now,
      maxTrackedPeers: 1,
    });
    const firstPeer = "203.0.113.15";
    const secondPeer = "203.0.113.17";

    recordFailedAuthentication(limiter, firstPeer);
    recordFailedAuthentication(limiter, firstPeer);
    recordFailedAuthentication(limiter, firstPeer);
    expect(limiter.canAttemptAuthentication(firstPeer)).toBe(false);

    expect(limiter.canAttemptAuthentication(secondPeer)).toBe(true);
    expect(limiter.canAttemptAuthentication(firstPeer)).toBe(true);
  });
});

describe("admin peer address", () => {
  it("ignores forwarded headers without explicit proxy trust", () => {
    expect(normalizedPeerAddress({
      socketAddress: "::ffff:10.0.0.4",
      forwardedFor: "203.0.113.20, 10.0.0.4",
      trustProxy: false,
    })).toBe("10.0.0.4");
  });

  it("uses CloudFront's rightmost appended viewer address behind a trusted proxy", () => {
    expect(normalizedPeerAddress({
      socketAddress: "10.0.0.4",
      forwardedFor: "203.0.113.20, 10.0.0.4",
      trustProxy: true,
    })).toBe("10.0.0.4");
  });
});

function limiterFor(clock: FakeClock): AdminAccessLimiter {
  return new AdminAccessLimiter({ now: clock.now });
}

function recordFailedAuthentication(limiter: AdminAccessLimiter, peer: string): boolean {
  expect(limiter.canAttemptAuthentication(peer)).toBe(true);
  return limiter.recordFailedAuthentication(peer);
}

class FakeClock {
  private value = 1_000;

  now = (): number => this.value;

  advance(milliseconds: number): void {
    this.value += milliseconds;
  }
}
