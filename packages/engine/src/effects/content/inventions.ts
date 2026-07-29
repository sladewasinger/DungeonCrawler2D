import { z } from "zod";
import { itemDefSchema, type ItemDef } from "./items.js";
import { recipeDefSchema, type RecipeDef } from "./recipes.js";
import { buildContentRegistry, type ContentRegistry } from "./registry.js";

const safeId = z.string().min(3).max(64).regex(/^[a-z][a-z0-9._-]*$/);
const isoTimestamp = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
);

export const inventionProvenanceSchema = z.object({
  generator: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: isoTimestamp,
}).strict();

export const inventionProposalSchema = z.object({
  proposalId: safeId,
  item: itemDefSchema.strict(),
  recipe: recipeDefSchema.strict(),
  provenance: inventionProvenanceSchema,
}).strict();

export type InventionProposal = z.infer<typeof inventionProposalSchema>;

export interface PendingInvention {
  readonly proposalId: string;
  readonly item: ItemDef;
  readonly recipe: RecipeDef;
  readonly provenance: z.infer<typeof inventionProvenanceSchema>;
  readonly state: "pending_review";
  readonly craftable: false;
  readonly requiredReviews: readonly ["moderation", "balance", "economy"];
}

export type InventionValidation =
  | { ok: true; invention: PendingInvention }
  | { ok: false; errors: string[] };

const parseErrors = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join(".") || "proposal"}: ${issue.message}`);

function validateRegistryReferences(
  content: ContentRegistry,
  item: ItemDef,
  recipe: RecipeDef,
): string | null {
  try {
    buildContentRegistry({
      statuses: [...content.statuses.values()],
      rules: [...content.rules],
      areaReactions: [...content.areaReactions],
      areas: [...content.areas.values()],
      items: [...content.items.values(), item],
      enemies: [...content.enemies.values()],
      recipes: [...content.recipes.values(), recipe],
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "content references are invalid";
  }
}

/** Validates and stages generated content. This deliberately has no activation
 * operation: provider output remains non-craftable until product-owned review,
 * balance, rollback, and moderation policies exist. */
export function validateInventionProposal(
  content: ContentRegistry,
  raw: unknown,
): InventionValidation {
  const parsed = inventionProposalSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parseErrors(parsed.error) };
  const { item, recipe } = parsed.data;
  const errors = proposalErrors(content, item, recipe);
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, invention: pendingInvention(parsed.data) };
}

function proposalErrors(content: ContentRegistry, item: ItemDef, recipe: RecipeDef): string[] {
  return [
    ...duplicateIdErrors(content, item, recipe),
    ...recipeErrors(content, item, recipe),
    ...referenceErrors(content, item, recipe),
  ];
}

function duplicateIdErrors(content: ContentRegistry, item: ItemDef, recipe: RecipeDef): string[] {
  return [
    ...(content.items.has(item.id) ? [`item id "${item.id}" already exists`] : []),
    ...(content.recipes.has(recipe.id) ? [`recipe id "${recipe.id}" already exists`] : []),
  ];
}

function recipeErrors(content: ContentRegistry, item: ItemDef, recipe: RecipeDef): string[] {
  const errors = recipe.output.item === item.id ? [] : ["recipe output must be the proposed item"];
  if (recipe.inputs.length === 0) errors.push("recipe must consume at least one existing item");
  return [...errors, ...unknownInputErrors(content, recipe)];
}

function unknownInputErrors(content: ContentRegistry, recipe: RecipeDef): string[] {
  return recipe.inputs.filter((input) => !content.items.has(input.item)).map((input) => `recipe input "${input.item}" is unknown`);
}

function referenceErrors(content: ContentRegistry, item: ItemDef, recipe: RecipeDef): string[] {
  const error = validateRegistryReferences(content, item, recipe);
  return error ? [error] : [];
}

function pendingInvention(proposal: InventionProposal): PendingInvention {
  const { proposalId, item, recipe, provenance } = proposal;
  return { proposalId, item, recipe, provenance, state: "pending_review", craftable: false, requiredReviews: ["moderation", "balance", "economy"] };
}

export class InventionReviewQueue {
  private readonly proposals = new Map<string, PendingInvention>();
  private readonly itemIds = new Set<string>();
  private readonly recipeIds = new Set<string>();

  submit(content: ContentRegistry, raw: unknown): InventionValidation {
    const result = validateInventionProposal(content, raw);
    if (!result.ok) return result;
    const { invention } = result;
    const errors: string[] = [];
    if (this.proposals.has(invention.proposalId)) errors.push("proposal id already staged");
    if (this.itemIds.has(invention.item.id)) errors.push("item id already staged");
    if (this.recipeIds.has(invention.recipe.id)) errors.push("recipe id already staged");
    if (errors.length > 0) return { ok: false, errors };
    this.proposals.set(invention.proposalId, invention);
    this.itemIds.add(invention.item.id);
    this.recipeIds.add(invention.recipe.id);
    return result;
  }

  list(): readonly PendingInvention[] {
    return [...this.proposals.values()];
  }
}
