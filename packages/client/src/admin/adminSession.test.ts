import { describe, expect, it } from "vitest";
import {
  clearAdminSessionKey,
  loadAdminSessionKey,
  saveAdminSessionKey,
} from "./adminSession.js";
import type { IdentityStorage } from "../net/auth/identityStorage.js";

class MemoryStorage implements IdentityStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("admin session persistence", () => {
  it("persists only the server-issued opaque continuation key in session storage", () => {
    const session = new MemoryStorage();
    const local = new MemoryStorage();
    const sessionKey = "a".repeat(43);

    expect(saveAdminSessionKey(sessionKey, session)).toBe(true);
    expect(loadAdminSessionKey(session)).toBe(sessionKey);
    expect(loadAdminSessionKey(local)).toBeUndefined();
  });

  it("clears an expired or rejected continuation key", () => {
    const storage = new MemoryStorage();
    saveAdminSessionKey("a".repeat(43), storage);

    clearAdminSessionKey(storage);

    expect(loadAdminSessionKey(storage)).toBeUndefined();
  });
});
