import { enemiesData, itemsData } from "@dc2d/content";
import { PET_DEFINITIONS } from "@dc2d/engine";
import { PET_ASSETS } from "../../boot/petAssetManifest.js";
import { describe, expect, it } from "vitest";
import {
  adminCatalogEntries,
  type AdminCatalogEntry,
} from "./adminCatalogDefinitions.js";

describe("admin spawn catalog definitions", () => {
  it("covers every content enemy without a definition allowlist", () => {
    expect(entryIds("enemy")).toEqual(contentIds(enemiesData));
  });

  it("puts every content item into exactly one matching spawn category", () => {
    expect(entryIds("weapon")).toEqual(contentItemIds(true));
    expect(entryIds("item")).toEqual(contentItemIds(false));
  });

  it("covers every shared pet definition with a matching pet asset", () => {
    const petIds = PET_DEFINITIONS.map((definition) => definition.id).sort();

    expect(entryIds("pet")).toEqual(petIds);
    expect(Object.keys(PET_ASSETS).sort()).toEqual(petIds);
  });

  it("exposes authored weapon knockback with the other combat stats", () => {
    const hammer = entryById("weapon", "hammer");

    expect(hammer).toMatchObject({
      name: "Heavy Hammer",
      stats: ["7 DMG", "2.5 RNG", "20 KB", "500 MS"],
    });
    expect(adminCatalogEntries("weapon").every(hasKnockbackStat)).toBe(true);
  });

  it("keeps authored content stats even when a card has no atlas crop", () => {
    const entries = adminCatalogEntries("enemy");

    expect(entries).toHaveLength(contentIds(enemiesData).length);
    expect(entries.every((entry) => entry.stats.length > 0)).toBe(true);
    expect(entries.every(hasHurtboxStat)).toBe(true);
    expect(entryById("enemy", "training-dummy").stats).toContain("1.08×1.08×1.52 HURTBOX");
  });
});

function entryIds(kind: "enemy" | "item" | "weapon" | "pet"): string[] {
  return adminCatalogEntries(kind).map((entry) => entry.id).sort();
}

function entryById(kind: "enemy" | "item" | "weapon" | "pet", id: string): AdminCatalogEntry {
  return adminCatalogEntries(kind).find((entry) => entry.id === id)!;
}

function contentIds(definitions: readonly unknown[]): string[] {
  return definitions.map(contentId).sort();
}

function contentItemIds(weapon: boolean): string[] {
  return itemsData
    .filter((definition) => isWeapon(definition) === weapon)
    .map(contentId)
    .sort();
}

function contentId(definition: unknown): string {
  return (definition as { readonly id: string }).id;
}

function isWeapon(definition: unknown): boolean {
  return (definition as { readonly weapon?: unknown }).weapon !== undefined;
}

function hasKnockbackStat(entry: AdminCatalogEntry): boolean {
  return entry.stats.some((stat) => stat.endsWith(" KB"));
}

function hasHurtboxStat(entry: AdminCatalogEntry): boolean {
  return entry.stats.some((stat) => stat.endsWith(" HURTBOX"));
}
