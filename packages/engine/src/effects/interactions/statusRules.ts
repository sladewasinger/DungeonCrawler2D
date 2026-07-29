import type { Entity } from "../../entities/entity.js";
import type { EffectEvent } from "../events.js";
import { tagsOf, type EffectsState } from "../state.js";

export interface StatusInteractionRequest {
  readonly entity: Entity;
  readonly events: EffectEvent[];
}

export interface StatusInteractionOperations {
  readonly applyStatus: (statusId: string) => boolean;
  readonly removeStatusesByTag: (tag: string) => void;
}

interface InteractionPass {
  readonly state: EffectsState;
  readonly request: StatusInteractionRequest;
  readonly operations: StatusInteractionOperations;
}

type InteractionRule = EffectsState["content"]["rules"][number];

interface RuleApplication extends InteractionPass {
  readonly tags: ReadonlySet<string>;
  readonly rule: InteractionRule;
}

/** Resolve status-tag reactions to a bounded fixpoint. */
export function resolveStatusInteractions(
  state: EffectsState,
  request: StatusInteractionRequest,
  operations: StatusInteractionOperations,
): void {
  for (let pass = 0; pass < 4; pass++) {
    if (!applyInteractionPass({ state, request, operations })) return;
  }
}

function applyInteractionPass(pass: InteractionPass): boolean {
  const tags = tagsOf(pass.state, pass.request.entity);
  return pass.state.content.rules.reduce(
    (changed, rule) =>
      applyMatchingRule({ ...pass, tags, rule }) || changed,
    false,
  );
}

function applyMatchingRule(application: RuleApplication): boolean {
  const { tags, rule, operations } = application;
  if (!tags.has(rule.when[0]) || !tags.has(rule.when[1])) return false;
  const removed = removeRuleTags(rule.removeTags, operations);
  return applyRuleStatus(rule.apply, operations) || removed;
}

function removeRuleTags(
  tags: readonly string[] | undefined,
  operations: StatusInteractionOperations,
): boolean {
  if (!tags) return false;
  for (const tag of tags) operations.removeStatusesByTag(tag);
  return true;
}

function applyRuleStatus(
  statusId: string | undefined,
  operations: StatusInteractionOperations,
): boolean {
  if (!statusId) return false;
  return operations.applyStatus(statusId);
}
