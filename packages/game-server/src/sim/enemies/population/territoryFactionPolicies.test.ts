import { TERRITORY_IDS, territoryProfile } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  factionRosterForOwnershipTags,
  TERRITORY_FACTION_POLICIES,
} from "./territoryFactionPolicies.js";

describe("finite territory faction policies", () => {
  it("declares a policy for every catalog ownership tag", () => {
    const tags = catalogOwnershipTags();
    for (const tag of tags) {
      const policy = TERRITORY_FACTION_POLICIES[tag];
      expect(policy?.length).toBeGreaterThanOrEqual(3);
      expect(factionRosterForOwnershipTags([tag])).toEqual(policy);
    }
  });

  it("rejects an undeclared tag instead of using a biome fallback", () => {
    expect(() => factionRosterForOwnershipTags(["unlisted-faction"])).toThrow(
      "No faction policy for territory tag: unlisted-faction",
    );
  });
});

function catalogOwnershipTags(): Set<string> {
  const tags = new Set<string>();
  for (const id of Object.values(TERRITORY_IDS)) {
    for (const tag of territoryProfile(id).ownershipTags) tags.add(tag);
  }
  return tags;
}
