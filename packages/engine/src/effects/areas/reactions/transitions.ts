import type { AreaReactionAction } from "../../content/areaReactions.js";
import type { ContentRegistry } from "../../types.js";
import { composeAreaLayer } from "../layers.js";
import { layerHasAreaTag, matchAreaReaction, type AreaReactionMatch } from "./matching.js";
import type { AreaLayer } from "../types.js";

const MAX_TRANSITIONS = 8;

export type AreaTransitionResult =
  | { readonly ok: true; readonly layers: AreaLayer[] }
  | { readonly ok: false; readonly detail: string };

export function resolveAreaTransitions(
  content: ContentRegistry,
  initial: readonly AreaLayer[],
): AreaTransitionResult {
  let layers = [...initial];
  const states = new Set<string>([stateKey(layers)]);
  for (let count = 0; count < MAX_TRANSITIONS; count++) {
    const transition = nextTransition(content, layers);
    if (!transition) return { ok: true, layers };
    if (!transition.ok) return transition;
    const signature = stateKey(transition.layers);
    if (states.has(signature)) {
      return { ok: false, detail: "repeated compound-area state" };
    }
    states.add(signature);
    layers = transition.layers;
  }
  return { ok: false, detail: `area transition cap ${MAX_TRANSITIONS} exceeded` };
}

function nextTransition(
  content: ContentRegistry,
  layers: AreaLayer[],
): AreaTransitionResult | null {
  for (const reaction of content.areaReactions) {
    const actions = reaction.actions.filter(isTransitionAction);
    if (actions.length === 0) continue;
    const match = matchAreaReaction(content, layers, reaction);
    if (!match) continue;
    return planTransition({
      content,
      layers,
      actions,
      match,
      reactionId: reaction.id,
    });
  }
  return null;
}

interface TransitionRequest {
  readonly content: ContentRegistry;
  readonly layers: AreaLayer[];
  readonly actions: readonly TransitionAction[];
  readonly match: AreaReactionMatch;
  readonly reactionId: string;
}

function planTransition(request: TransitionRequest): AreaTransitionResult {
  const { content, layers, actions, match, reactionId } = request;
  const plan = transitionPlan(actions);
  let next = layers.filter((layer) =>
    ![...plan.removedTags].some((tag) => layerHasAreaTag(content, layer, tag))
  );
  for (const addition of plan.additions) {
    const layer = reactionLayer(content, addition, match);
    if (!layer) return { ok: false, detail: `${reactionId} adds unknown area` };
    const composed = composeAreaLayer(content, next, layer);
    if (!composed.ok) {
      return { ok: false, detail: `${reactionId} has ${composed.reason}` };
    }
    next = composed.layers;
  }
  return { ok: true, layers: next };
}

type TransitionAction = Exclude<
  AreaReactionAction,
  { op: "rate_consume" }
>;

interface PlannedAddition {
  readonly area: string;
  readonly sourceFromTag?: string;
}

interface TransitionPlan {
  readonly removedTags: ReadonlySet<string>;
  readonly additions: readonly PlannedAddition[];
}

function transitionPlan(actions: readonly TransitionAction[]): TransitionPlan {
  const removedTags = new Set<string>();
  const additions = new Map<string, PlannedAddition>();
  for (const action of actions) {
    if (action.op === "remove") removedTags.add(action.tag);
    if (action.op === "transform") removedTags.add(action.tag);
    if (action.op === "add" || action.op === "transform") {
      additions.set(action.area, sourceAddition(action));
    }
  }
  return {
    removedTags,
    additions: [...additions.values()].sort((a, b) => a.area.localeCompare(b.area)),
  };
}

function sourceAddition(
  action: Extract<TransitionAction, { op: "add" | "transform" }>,
): PlannedAddition {
  return {
    area: action.area,
    ...(action.sourceFromTag === undefined
      ? {}
      : { sourceFromTag: action.sourceFromTag }),
  };
}

function reactionLayer(
  content: ContentRegistry,
  addition: PlannedAddition,
  match: AreaReactionMatch,
): AreaLayer | null {
  const def = content.areas.get(addition.area);
  if (!def) return null;
  const source = addition.sourceFromTag
    ? match.byTag.get(addition.sourceFromTag)
    : undefined;
  return {
    defId: def.id,
    remaining: def.duration,
    steps: source?.steps ?? 0,
    ...(source?.sourceId === undefined ? {} : { sourceId: source.sourceId }),
  };
}

function isTransitionAction(
  action: AreaReactionAction,
): action is TransitionAction {
  return action.op !== "rate_consume";
}

function stateKey(layers: readonly AreaLayer[]): string {
  return layers.map((layer) => layer.defId).sort().join("|");
}
