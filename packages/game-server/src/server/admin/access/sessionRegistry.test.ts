import { describe, expect, it } from "vitest";
import { createAdminSession } from "./authorization.js";
import { AdminSessionRegistry } from "./sessionRegistry.js";

describe("admin session registry", () => {
  it("resumes an opaque session only for the peer that authenticated it", () => {
    const registry = new AdminSessionRegistry();
    const session = createAdminSession();
    const sessionKey = registry.issue({ session, peerAddress: "127.0.0.1" });

    expect(sessionKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(registry.resume({ sessionKey, peerAddress: "127.0.0.1" })).toBe(session);
    expect(registry.resume({ sessionKey, peerAddress: "198.51.100.10" })).toBeNull();
  });

  it("expires an inactive session", () => {
    let now = 1_000;
    const registry = new AdminSessionRegistry({ now: () => now, sessionTtlMs: 100 });
    const sessionKey = registry.issue({ session: createAdminSession(now), peerAddress: "127.0.0.1" });

    now += 100;

    expect(registry.resume({ sessionKey, peerAddress: "127.0.0.1" })).toBeNull();
  });

  it("does not scan unrelated expired sessions during a valid resume", () => {
    let now = 1_000;
    const registry = new AdminSessionRegistry({ now: () => now, sessionTtlMs: 100 });
    const expiredKey = registry.issue({ session: createAdminSession(now), peerAddress: "127.0.0.1" });
    const liveKey = registry.issue({ session: createAdminSession(now), peerAddress: "127.0.0.1" });

    now += 99;
    registry.resume({ sessionKey: liveKey, peerAddress: "127.0.0.1" });
    now += 2;
    registry.resume({ sessionKey: liveKey, peerAddress: "127.0.0.1" });

    expect(storedSessions(registry).has(expiredKey)).toBe(true);
  });

  it("revokes the exact authenticated session without affecting another admin", () => {
    const registry = new AdminSessionRegistry();
    const first = createAdminSession();
    const second = createAdminSession();
    const firstKey = registry.issue({ session: first, peerAddress: "127.0.0.1" });
    const secondKey = registry.issue({ session: second, peerAddress: "127.0.0.1" });

    expect(registry.revoke(first)).toBe(true);
    expect(registry.resume({ sessionKey: firstKey, peerAddress: "127.0.0.1" })).toBeNull();
    expect(registry.resume({ sessionKey: secondKey, peerAddress: "127.0.0.1" })).toBe(second);
  });

  it("invalidates every live socket bound to a revoked session", () => {
    const registry = new AdminSessionRegistry();
    const session = createAdminSession();
    registry.issue({ session, peerAddress: "127.0.0.1" });
    const invalidations: string[] = [];

    bind({ registry, session, binding: {}, invalidations });
    bind({ registry, session, binding: {}, invalidations });

    expect(registry.revoke(session)).toBe(true);
    expect(invalidations).toEqual(["revoked", "revoked"]);
    expect(registry.isActive({ session, peerAddress: "127.0.0.1" })).toBe(false);
  });

  it("expires a live session before it can authorize another command", () => {
    let now = 1_000;
    const registry = new AdminSessionRegistry({ now: () => now, sessionTtlMs: 100 });
    const session = createAdminSession(now);
    registry.issue({ session, peerAddress: "127.0.0.1" });
    const invalidations: string[] = [];

    bind({ registry, session, binding: {}, invalidations });
    now += 100;

    expect(registry.isActive({ session, peerAddress: "127.0.0.1" })).toBe(false);
    expect(invalidations).toEqual(["expired"]);
  });

  it("extends a live session only after an authorized action", () => {
    let now = 1_000;
    const registry = new AdminSessionRegistry({ now: () => now, sessionTtlMs: 100 });
    const session = createAdminSession(now);
    registry.issue({ session, peerAddress: "127.0.0.1" });

    now += 99;
    expect(registry.touch({ session, peerAddress: "127.0.0.1" })).toBe(true);
    now += 99;

    expect(registry.isActive({ session, peerAddress: "127.0.0.1" })).toBe(true);
  });
});

function storedSessions(registry: AdminSessionRegistry): Map<string, unknown> {
  return (registry as unknown as { sessions: Map<string, unknown> }).sessions;
}

function bind(input: {
  readonly registry: AdminSessionRegistry;
  readonly session: ReturnType<typeof createAdminSession>;
  readonly binding: object;
  readonly invalidations: string[];
}): void {
  input.registry.bind({
    session: input.session,
    peerAddress: "127.0.0.1",
    binding: input.binding,
    onInvalidated: (reason) => input.invalidations.push(reason),
  });
}
