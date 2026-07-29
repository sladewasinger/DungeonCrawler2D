import type { AreaDef } from "./areas.js";
import type { AreaReaction } from "./areaReactions.js";
import type { ParsedContent } from "./parse.js";
import { AREA_CHANNELS } from "../areas/layers.js";
import { resolveAreaTransitions } from "../areas/reactions/transitions.js";
import type { AreaLayer } from "../areas/types.js";

const MAX_STATIC_STATES = 4_096;

export function validateAreaReactionTermination(content: ParsedContent): void {
  const reactions = content.areaReactions.filter(hasTransition);
  if (reactions.length === 0) return;
  const states = possibleStates(relevantAreas(content, reactions));
  validateDirectSelfRefresh(content, reactions, states);
  for (const state of states) validateStateTermination(content, state);
}

function validateDirectSelfRefresh(
  content: ParsedContent,
  reactions: readonly AreaReaction[],
  states: readonly AreaDef[][],
): void {
  for (const reaction of reactions) {
    const refreshes = states.some((state) =>
      directlySelfRefreshes({ content, reaction, state })
    );
    if (refreshes) {
      throw new Error(`area reaction ${reaction.id} directly self-refreshes`);
    }
  }
}

interface DirectRefreshEvaluation {
  readonly content: ParsedContent;
  readonly reaction: AreaReaction;
  readonly state: readonly AreaDef[];
}

function directlySelfRefreshes(request: DirectRefreshEvaluation): boolean {
  const { content, reaction, state } = request;
  if (!isMinimalMatch(state, reaction)) return false;
  const isolated = { ...content, areaReactions: [reaction] };
  const result = resolveAreaTransitions(isolated, stateLayers(state));
  if (result.ok) return false;
  return producesExistingArea(reaction, state)
    || isNonTerminating(result.detail);
}

function isMinimalMatch(
  state: readonly AreaDef[],
  reaction: AreaReaction,
): boolean {
  return state.length === 2 && stateMatches(state, reaction);
}

function producesExistingArea(
  reaction: AreaReaction,
  state: readonly AreaDef[],
): boolean {
  const existingIds = new Set(state.map((area) => area.id));
  return producedAreaIds(reaction).some((id) => existingIds.has(id));
}

function validateStateTermination(
  content: ParsedContent,
  state: readonly AreaDef[],
): void {
  const result = resolveAreaTransitions(content, stateLayers(state));
  if (result.ok || !isNonTerminating(result.detail)) return;
  const ids = state.map((area) => area.id).sort().join("+");
  throw new Error(`area reaction transition cycle from ${ids}`);
}

function relevantAreas(
  content: ParsedContent,
  reactions: readonly AreaReaction[],
): AreaDef[] {
  const triggerTags = new Set(reactions.flatMap((reaction) => reaction.when));
  const producedIds = new Set(reactions.flatMap(producedAreaIds));
  return [...content.areas.values()].filter((area) => isRelevantArea({
    area,
    triggerTags,
    producedIds,
  }));
}

interface AreaRelevance {
  readonly area: AreaDef;
  readonly triggerTags: ReadonlySet<string>;
  readonly producedIds: ReadonlySet<string>;
}

function isRelevantArea(request: AreaRelevance): boolean {
  return request.producedIds.has(request.area.id)
    || request.area.tags.some((tag) => request.triggerTags.has(tag));
}

function producedAreaIds(reaction: AreaReaction): string[] {
  return reaction.actions.flatMap((action) =>
    action.op === "add" || action.op === "transform" ? [action.area] : []
  );
}

function possibleStates(areas: readonly AreaDef[]): AreaDef[][] {
  const groups = AREA_CHANNELS.map((channel) =>
    areas.filter((area) => area.channel === channel)
  );
  const stateCount = groups.reduce((count, group) => count * (group.length + 1), 1);
  if (stateCount > MAX_STATIC_STATES) {
    throw new Error(`area reaction state count exceeds ${MAX_STATIC_STATES}`);
  }
  return combineChannels(groups).filter((state) => state.length >= 2);
}

function combineChannels(groups: readonly AreaDef[][]): AreaDef[][] {
  let states: AreaDef[][] = [[]];
  for (const group of groups) {
    const options: Array<AreaDef | undefined> = [undefined, ...group];
    states = states.flatMap((state) =>
      options.map((area) => area ? [...state, area] : state)
    );
  }
  return states;
}

function stateMatches(
  state: readonly AreaDef[],
  reaction: AreaReaction,
): boolean {
  const first = state.find((area) => area.tags.includes(reaction.when[0]));
  return Boolean(first && state.some((area) =>
    area !== first && area.tags.includes(reaction.when[1])
  ));
}

function stateLayers(state: readonly AreaDef[]): AreaLayer[] {
  return state.map((area) => ({
    defId: area.id,
    remaining: area.duration,
    steps: 0,
  }));
}

function hasTransition(reaction: AreaReaction): boolean {
  return reaction.actions.some((action) => action.op !== "rate_consume");
}

function isNonTerminating(detail: string): boolean {
  return detail.includes("repeated compound-area state")
    || detail.includes("transition cap");
}
