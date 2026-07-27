import { describe, expect, it } from "vitest";
import {
  loadResumeToken,
  loadTabPreference,
  persistentClientId,
  saveResumeToken,
  saveTabPreference,
  type IdentityStorage,
  type IdentityStorageContext,
} from "./identity.js";

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

  clone(): MemoryStorage {
    const copy = new MemoryStorage();
    for (const [key, value] of this.values) copy.values.set(key, value);
    return copy;
  }
}

class MemoryTabMarker {
  constructor(private value: string | null = null) {}

  read(): string | null {
    return this.value;
  }

  write(value: string): boolean {
    this.value = value;
    return true;
  }
}

const context = (
  sessionStorage: IdentityStorage | null,
  localStorage: IdentityStorage,
  tabMarker?: MemoryTabMarker,
): IdentityStorageContext => ({
  sessionStorage,
  localStorage,
  ...(tabMarker ? { tabMarker } : {}),
});

describe("tab-scoped connection identity", () => {
  it("keeps two tabs on distinct client and resume identities across reconnects", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem("dc2d-client-id", "legacy-shared-client");
    const tabA = context(new MemoryStorage(), sharedLocal);
    const tabB = context(new MemoryStorage(), sharedLocal);

    const clientA = persistentClientId(tabA);
    const clientB = persistentClientId(tabB);
    saveResumeToken("resume-a", "dungeon", tabA);
    saveResumeToken("resume-b", "dungeon", tabB);

    expect(clientA).not.toBe("legacy-shared-client");
    expect(clientB).not.toBe("legacy-shared-client");
    expect(clientA).not.toBe(clientB);
    expect(loadResumeToken("dungeon", tabA)).toBe("resume-a");
    expect(loadResumeToken("dungeon", tabB)).toBe("resume-b");

    expect({
      clientId: persistentClientId(tabA),
      resumeToken: loadResumeToken("dungeon", tabA),
    }).toEqual({ clientId: clientA, resumeToken: "resume-a" });
    expect({
      clientId: persistentClientId(tabB),
      resumeToken: loadResumeToken("dungeon", tabB),
    }).toEqual({ clientId: clientB, resumeToken: "resume-b" });
  });

  it("uses local storage only when tab storage is unavailable", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem("dc2d-client-id", "local-fallback-client");
    const fallback = context(null, sharedLocal);

    expect(persistentClientId(fallback)).toBe("local-fallback-client");
    saveResumeToken("fallback-token", "sandbox", fallback);
    expect(loadResumeToken("sandbox", fallback)).toBe("fallback-token");
  });

  it("keeps local-storage resume tokens tab-scoped when session storage is unavailable", () => {
    const sharedLocal = new MemoryStorage();
    const source = context(null, sharedLocal, new MemoryTabMarker());
    const sourceClient = persistentClientId(source);
    saveResumeToken("source-token", "dungeon", source);

    const duplicate = context(null, sharedLocal, new MemoryTabMarker());
    const duplicateClient = persistentClientId(duplicate);

    expect(duplicateClient).not.toBe(sourceClient);
    expect(loadResumeToken("dungeon", source)).toBe("source-token");
    expect(loadResumeToken("dungeon", duplicate)).toBeUndefined();
  });

  it("rotates a duplicated session identity and does not resume the source tab", () => {
    const sharedLocal = new MemoryStorage();
    const sourceSession = new MemoryStorage();
    const source = context(sourceSession, sharedLocal, new MemoryTabMarker());
    const sourceClient = persistentClientId(source);
    saveResumeToken("source-token", "dungeon", source);

    const duplicatedSession = sourceSession.clone();
    const duplicate = context(duplicatedSession, sharedLocal, new MemoryTabMarker());
    const duplicateClient = persistentClientId(duplicate);

    expect(duplicateClient).not.toBe(sourceClient);
    expect(persistentClientId(source)).toBe(sourceClient);
    expect(loadResumeToken("dungeon", source)).toBe("source-token");
    expect(loadResumeToken("dungeon", duplicate)).toBeUndefined();
  });
});

describe("tab-scoped player preferences", () => {
  it("lets each tab override shared name and character preferences", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem("dc2d-name", "SharedCrawler");
    sharedLocal.setItem("dc2d-player-skin", "knight_f");
    const tabA = context(new MemoryStorage(), sharedLocal);
    const tabB = context(new MemoryStorage(), sharedLocal);

    expect(loadTabPreference("dc2d-name", tabA)).toBe("SharedCrawler");
    expect(loadTabPreference("dc2d-player-skin", tabB)).toBe("knight_f");

    saveTabPreference("dc2d-name", "CrawlerA", tabA);
    saveTabPreference("dc2d-player-skin", "elf_f", tabA);
    saveTabPreference("dc2d-name", "CrawlerB", tabB);
    saveTabPreference("dc2d-player-skin", "dwarf_m", tabB);

    expect(loadTabPreference("dc2d-name", tabA)).toBe("CrawlerA");
    expect(loadTabPreference("dc2d-player-skin", tabA)).toBe("elf_f");
    expect(loadTabPreference("dc2d-name", tabB)).toBe("CrawlerB");
    expect(loadTabPreference("dc2d-player-skin", tabB)).toBe("dwarf_m");
    expect(sharedLocal.getItem("dc2d-name")).toBe("CrawlerB");
    expect(sharedLocal.getItem("dc2d-player-skin")).toBe("dwarf_m");
  });
});
