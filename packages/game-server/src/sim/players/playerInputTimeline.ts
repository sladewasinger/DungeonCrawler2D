import {
  PROJECTED_INPUT_MAX_FUTURE_TICKS,
  PROJECTED_INPUT_MAX_PAST_TICKS,
  type ClientInput,
} from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";

export function handleInput(sim: SimState, playerId: string, input: ClientInput): void {
  const slot = sim.players.get(playerId);
  if (!slot || !slot.connected || slot.entity.hp <= 0 || slot.downedAtTick !== null) return;
  const highestReceivedSeq = slot.highestReceivedSeq ?? slot.lastSeq;
  if (input.seq <= highestReceivedSeq) return;
  if (!alignInputTimeline(slot, input.projectedServerTick)) return;
  slot.highestReceivedSeq = input.seq;
  queueByProjectedTick(slot.pendingInputs, input);
}

export function advanceInputTimeline(slot: PlayerSlot): ClientInput | undefined {
  const timelineTick = nextTimelineTick(slot);
  const consumedInput = consumeThrough(slot, timelineTick);
  if (consumedInput) {
    slot.heldInput = consumedInput;
    slot.lastSeq = consumedInput.seq;
  }
  if (timelineTick !== null) slot.lastProjectedServerTick = timelineTick;
  return slot.heldInput;
}

export function resetInputTimeline(slot: PlayerSlot): void {
  slot.pendingInputs.length = 0;
  delete slot.heldInput;
  slot.lastProjectedServerTick = -1;
}

/** Acknowledges one due input tick while an authoritative sequence owns movement. */
export function suppressInputTimeline(slot: PlayerSlot): void {
  advanceInputTimeline(slot);
  delete slot.heldInput;
}

function alignInputTimeline(
  slot: PlayerSlot,
  projectedTick: number,
): boolean {
  const lastTimelineTick = slot.lastProjectedServerTick ?? -1;
  if (lastTimelineTick < 0) return true;
  if (projectedTick < lastTimelineTick - PROJECTED_INPUT_MAX_PAST_TICKS) {
    return false;
  }
  if (projectedTick > lastTimelineTick + PROJECTED_INPUT_MAX_FUTURE_TICKS) {
    slot.pendingInputs.length = 0;
    slot.lastProjectedServerTick = projectedTick - 1;
  }
  return true;
}

function queueByProjectedTick(queue: ClientInput[], input: ClientInput): void {
  const sameTickIndex = queue.findIndex(
    (queued) => queued.projectedServerTick === input.projectedServerTick,
  );
  if (sameTickIndex >= 0) {
    queue[sameTickIndex] = input;
    return;
  }
  const laterTickIndex = queue.findIndex(
    (queued) => queued.projectedServerTick > input.projectedServerTick,
  );
  if (laterTickIndex < 0) {
    queue.push(input);
    return;
  }
  for (let index = queue.length; index > laterTickIndex; index--) {
    const previous = queue[index - 1];
    if (previous) queue[index] = previous;
  }
  queue[laterTickIndex] = input;
}

function nextTimelineTick(slot: PlayerSlot): number | null {
  const lastTick = slot.lastProjectedServerTick ?? -1;
  if (lastTick >= 0) return lastTick + 1;
  return slot.pendingInputs[0]?.projectedServerTick ?? null;
}

function consumeThrough(slot: PlayerSlot, timelineTick: number | null): ClientInput | undefined {
  if (timelineTick === null) return undefined;
  let consumedCount = 0;
  let latest: ClientInput | undefined;
  while (consumedCount < slot.pendingInputs.length) {
    const queued = slot.pendingInputs[consumedCount];
    if (!queued || queued.projectedServerTick > timelineTick) break;
    latest = queued;
    consumedCount++;
  }
  compactConsumed(slot.pendingInputs, consumedCount);
  return latest;
}

function compactConsumed(queue: ClientInput[], consumedCount: number): void {
  if (consumedCount === 0) return;
  const remainingCount = queue.length - consumedCount;
  for (let index = 0; index < remainingCount; index++) {
    const remaining = queue[index + consumedCount];
    if (remaining) queue[index] = remaining;
  }
  queue.length = remainingCount;
}
