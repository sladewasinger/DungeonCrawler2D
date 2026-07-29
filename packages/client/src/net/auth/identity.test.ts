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
const CLIENT_ID_KEY = "dc2d-client-id";
const LEGACY_CLIENT = "legacy-shared-client";
const DUNGEON = "dungeon";
const SOURCE_TOKEN = "source-token";
const NAME_KEY = "dc2d-name";
const SKIN_KEY = "dc2d-player-skin";

describe("tab-scoped connection identity", () => {
  it("keeps two tabs on distinct client and resume identities across reconnects", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem(CLIENT_ID_KEY, LEGACY_CLIENT);
    const tabA = context(new MemoryStorage(), sharedLocal);
    const tabB = context(new MemoryStorage(), sharedLocal);

    const clientA = persistentClientId(tabA);
    const clientB = persistentClientId(tabB);
    saveResumeToken("resume-a", DUNGEON, tabA);
    saveResumeToken("resume-b", DUNGEON, tabB);

    expect(clientA).not.toBe(LEGACY_CLIENT);
    expect(clientB).not.toBe(LEGACY_CLIENT);
    expect(clientA).not.toBe(clientB);
    expect(loadResumeToken(DUNGEON, tabA)).toBe("resume-a");
    expect(loadResumeToken(DUNGEON, tabB)).toBe("resume-b");

    expect({
      clientId: persistentClientId(tabA),
      resumeToken: loadResumeToken(DUNGEON, tabA),
    }).toEqual({ clientId: clientA, resumeToken: "resume-a" });
    expect({
      clientId: persistentClientId(tabB),
      resumeToken: loadResumeToken(DUNGEON, tabB),
    }).toEqual({ clientId: clientB, resumeToken: "resume-b" });
  });

  it("uses local storage only when tab storage is unavailable", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem(CLIENT_ID_KEY, "local-fallback-client");
    const fallback = context(null, sharedLocal);

    expect(persistentClientId(fallback)).toBe("local-fallback-client");
    saveResumeToken("fallback-token", "sandbox", fallback);
    expect(loadResumeToken("sandbox", fallback)).toBe("fallback-token");
  });

  it("keeps local-storage resume tokens tab-scoped when session storage is unavailable", () => {
    const sharedLocal = new MemoryStorage();
    const source = context(null, sharedLocal, new MemoryTabMarker());
    const sourceClient = persistentClientId(source);
    saveResumeToken(SOURCE_TOKEN, DUNGEON, source);

    const duplicate = context(null, sharedLocal, new MemoryTabMarker());
    const duplicateClient = persistentClientId(duplicate);

    expect(duplicateClient).not.toBe(sourceClient);
    expect(loadResumeToken(DUNGEON, source)).toBe(SOURCE_TOKEN);
    expect(loadResumeToken(DUNGEON, duplicate)).toBeUndefined();
  });

  it("rotates a duplicated session identity and does not resume the source tab", () => {
    const sharedLocal = new MemoryStorage();
    const sourceSession = new MemoryStorage();
    const source = context(sourceSession, sharedLocal, new MemoryTabMarker());
    const sourceClient = persistentClientId(source);
    saveResumeToken(SOURCE_TOKEN, DUNGEON, source);

    const duplicatedSession = sourceSession.clone();
    const duplicate = context(duplicatedSession, sharedLocal, new MemoryTabMarker());
    const duplicateClient = persistentClientId(duplicate);

    expect(duplicateClient).not.toBe(sourceClient);
    expect(persistentClientId(source)).toBe(sourceClient);
    expect(loadResumeToken(DUNGEON, source)).toBe(SOURCE_TOKEN);
    expect(loadResumeToken(DUNGEON, duplicate)).toBeUndefined();
  });
});

describe("tab-scoped player preferences", () => {
  it("lets each tab override shared name and character preferences", () => {
    const sharedLocal = new MemoryStorage();
    sharedLocal.setItem(NAME_KEY, "SharedCrawler");
    sharedLocal.setItem(SKIN_KEY, "knight_f");
    const tabA = context(new MemoryStorage(), sharedLocal);
    const tabB = context(new MemoryStorage(), sharedLocal);

    expect(loadTabPreference(NAME_KEY, tabA)).toBe("SharedCrawler");
    expect(loadTabPreference(SKIN_KEY, tabB)).toBe("knight_f");

    saveTabPreference(NAME_KEY, "CrawlerA", tabA);
    saveTabPreference(SKIN_KEY, "elf_f", tabA);
    saveTabPreference(NAME_KEY, "CrawlerB", tabB);
    saveTabPreference(SKIN_KEY, "dwarf_m", tabB);

    expect(loadTabPreference(NAME_KEY, tabA)).toBe("CrawlerA");
    expect(loadTabPreference(SKIN_KEY, tabA)).toBe("elf_f");
    expect(loadTabPreference(NAME_KEY, tabB)).toBe("CrawlerB");
    expect(loadTabPreference(SKIN_KEY, tabB)).toBe("dwarf_m");
    expect(sharedLocal.getItem(NAME_KEY)).toBe("CrawlerB");
    expect(sharedLocal.getItem(SKIN_KEY)).toBe("dwarf_m");
  });
});
