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
});

function storedSessions(registry: AdminSessionRegistry): Map<string, unknown> {
  return (registry as unknown as { sessions: Map<string, unknown> }).sessions;
}
