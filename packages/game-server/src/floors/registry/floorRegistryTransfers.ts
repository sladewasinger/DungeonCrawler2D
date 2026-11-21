import type { GameSim } from "../../sim/core/index.js";
import type { FloorTransferRequest } from "../../sim/state/domainTypes.js";
import type { FloorPreparationQueue } from "../preparation/floorPreparationQueue.js";
import type { TickResult } from "../preparation/floorRegistryTypes.js";
import { clampFloor } from "../floorRegistryPreparation.js";

export interface FloorRegistryTransferContext {
  readonly sims: Map<number, GameSim>;
  readonly transferQueue: FloorPreparationQueue;
  readonly prepare: (floor: number) => Promise<GameSim>;
}

export function applyTransfers(
  context: FloorRegistryTransferContext,
  active: readonly GameSim[],
): TickResult["moved"] {
  const moved: TickResult["moved"] = [];
  const requests = context.transferQueue.takePending();
  for (const sim of active) requests.push(...sim.takeOutgoingTransfers());
  for (const request of requests) applyTransfer(context, request, moved);
  return moved;
}

function applyTransfer(
  context: FloorRegistryTransferContext,
  request: FloorTransferRequest,
  moved: TickResult["moved"],
): void {
  const floor = clampFloor(request.targetFloor);
  const destination = context.sims.get(floor);
  if (!destination) {
    context.transferQueue.defer(request, floor, () => context.prepare(floor));
    return;
  }
  destination.receiveTransfer(request);
  moved.push({ playerId: request.slot.entity.id, sim: destination });
}
