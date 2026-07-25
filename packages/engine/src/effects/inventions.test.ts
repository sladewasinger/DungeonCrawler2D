import { describe, expect, it } from "vitest";
import { buildContentRegistry } from "./registry.js";
import { InventionReviewQueue, validateInventionProposal } from "./inventions.js";

const content = buildContentRegistry({
  statuses: [],
  rules: [],
  areas: [],
  items: [{ id: "wood", name: "Wood", tags: ["material"], maxStack: 99 }],
  enemies: [],
  recipes: [],
});

const proposal = {
  proposalId: "proposal.ember-plank",
  item: {
    id: "ember_plank",
    name: "Ember Plank",
    tags: ["material"],
    maxStack: 20,
  },
  recipe: {
    id: "craft_ember_plank",
    inputs: [{ item: "wood", qty: 2 }],
    output: { item: "ember_plank", qty: 1 },
  },
  provenance: {
    generator: "local-test",
    model: "fixture",
    requestHash: "a".repeat(64),
    createdAt: "2026-07-24T12:00:00.000Z",
  },
};

describe("invention proposal staging", () => {
  it("accepts valid content only into a non-craftable review state", () => {
    expect(validateInventionProposal(content, proposal)).toEqual({
      ok: true,
      invention: {
        ...proposal,
        state: "pending_review",
        craftable: false,
        requiredReviews: ["moderation", "balance", "economy"],
      },
    });
  });

  it("rejects malformed provenance before staging content", () => {
    const invalid = {
      ...proposal,
      provenance: { ...proposal.provenance, requestHash: "not-a-hash" },
    };
    const result = validateInventionProposal(content, invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("requestHash");
  });

  it("returns explicit collision, economy, and reference failures", () => {
    const invalid = {
      ...proposal,
      item: { ...proposal.item, id: "wood" },
      recipe: { ...proposal.recipe, inputs: [], output: { item: "different", qty: 1 } },
    };
    const result = validateInventionProposal(content, invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const errors = result.errors.join(" ");
    expect(errors).toContain("already exists");
    expect(errors).toContain("output must be the proposed item");
    expect(errors).toContain("at least one existing item");
  });

  it("enforces uniqueness across the pending global review queue", () => {
    const queue = new InventionReviewQueue();
    expect(queue.submit(content, proposal).ok).toBe(true);
    const duplicate = queue.submit(content, { ...proposal, proposalId: "proposal.two" });
    expect(duplicate).toEqual({ ok: false, errors: [
      "item id already staged",
      "recipe id already staged",
    ] });
    expect(queue.list()).toHaveLength(1);
  });
});
