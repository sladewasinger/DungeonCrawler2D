import type { EffectEvent, Entity } from "@dc2d/engine";
import { combatants } from "../core/helpers.js";
import { resolveFireContact } from "../progression/elemental/fireContact.js";
import type { SimState } from "../state/state.js";

const TORCH_FIRE_TAGS: ReadonlySet<string> = new Set(["fire"]);

export interface TorchFireContactRequest {
  readonly sim: SimState;
  readonly torch: Entity;
  readonly effectEvents: EffectEvent[];
  readonly landed?: boolean;
}

/** Resolves actor contact during flight and fuel contact on landing. */
export function resolveTorchFireContact({
  sim,
  torch,
  effectEvents,
  landed = false,
}: TorchFireContactRequest): void {
  const target = nearestTorchContact(sim, torch);
  if (target) resolveTorchActorContact({ sim, torch, target, effectEvents });
  if (landed) resolveTorchAreaContact({ sim, torch, effectEvents });
}

function resolveTorchActorContact({
  sim,
  torch,
  target,
  effectEvents,
}: TorchFireContactRequest & { target: Entity }): void {
  resolveFireContact({
    sim,
    source: torchFireSource(torch),
    target: { kind: "entity", entity: target },
    effectEvents,
  });
}

function resolveTorchAreaContact({
  sim,
  torch,
  effectEvents,
}: TorchFireContactRequest): void {
  resolveFireContact({
    sim,
    source: torchFireSource(torch),
    target: {
      kind: "area",
      x: Math.floor(torch.body.x),
      y: Math.floor(torch.body.y),
    },
    effectEvents,
  });
}

function torchFireSource(torch: Entity) {
  return torch.ownerId === undefined
    ? { tags: TORCH_FIRE_TAGS }
    : { tags: TORCH_FIRE_TAGS, sourceId: torch.ownerId };
}

function nearestTorchContact(sim: SimState, torch: Entity): Entity | undefined {
  return combatants(sim)
    .filter((candidate) => isTorchContact(candidate, torch))
    .sort((a, b) => torchContactOrder(a, b, torch))[0];
}

function torchContactOrder(a: Entity, b: Entity, torch: Entity): number {
  const distance = torchContactDistance(a, torch) - torchContactDistance(b, torch);
  return distance || a.id.localeCompare(b.id);
}

function isTorchContact(candidate: Entity, torch: Entity): boolean {
  if (candidate.id === torch.ownerId || candidate.hp <= 0) return false;
  return torchContactDistance(candidate, torch) < 0.7 &&
    Math.abs(candidate.body.z + 0.8 - torch.body.z) < 1.2;
}

function torchContactDistance(candidate: Entity, torch: Entity): number {
  return Math.hypot(candidate.body.x - torch.body.x, candidate.body.y - torch.body.y);
}
