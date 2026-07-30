import { describe, expect, it } from "vitest";
import {
  currentLightingMode,
  LIGHTING_MODES,
  lightingModeFromQuery,
  resolveLightingMode,
  savePersistedLightingMode,
} from "../lightingMode.js";

describe("toon lighting mode", () => {
  it("keeps classic as the persisted default", () => {
    expect(resolveLightingMode({
      query: "",
      persisted: LIGHTING_MODES.Classic,
    })).toBe(LIGHTING_MODES.Classic);
  });

  it("lets a valid URL mode override persisted settings for this load", () => {
    expect(resolveLightingMode({
      query: "?lighting=toon",
      persisted: LIGHTING_MODES.Classic,
    })).toBe(LIGHTING_MODES.Toon);
    expect(resolveLightingMode({
      query: "?lighting=classic",
      persisted: LIGHTING_MODES.Toon,
    })).toBe(LIGHTING_MODES.Classic);
  });

  it("does not let unrelated or invalid values override the persisted setting", () => {
    expect(lightingModeFromQuery("?lighting=soft")).toBeNull();
    expect(resolveLightingMode({
      query: "?view=toon",
      persisted: LIGHTING_MODES.Toon,
    })).toBe(LIGHTING_MODES.Toon);
  });

  it("persists a selected mode normally", () => {
    const writes: string[][] = [];
    const storage = {
      setItem: (key: string, value: string) => writes.push([key, value]),
    } as unknown as Storage;

    savePersistedLightingMode(LIGHTING_MODES.Toon, storage);

    expect(writes).toEqual([["dc2d-lighting-mode", LIGHTING_MODES.Toon]]);
  });

  it("keeps the selected mode for this session when persistence throws", () => {
    const storage = {
      setItem: () => {
        throw new Error("storage unavailable");
      },
    } as unknown as Storage;

    expect(() => savePersistedLightingMode(LIGHTING_MODES.Classic, storage)).not.toThrow();
    savePersistedLightingMode(LIGHTING_MODES.Toon, storage);

    expect(currentLightingMode()).toBe(LIGHTING_MODES.Toon);
  });
});
