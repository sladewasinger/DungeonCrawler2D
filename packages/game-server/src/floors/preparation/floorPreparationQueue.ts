import type { GameSim } from "../../sim/core/index.js";
import type { FloorTransferRequest } from "../../sim/state/domainTypes.js";

type FloorPreparation = () => GameSim | Promise<GameSim>;

export class FloorPreparationQueue {
  private readonly pending = new Map<string, FloorTransferRequest>();
  private readonly preparations = new Map<number, Promise<GameSim>>();

  takePending(): FloorTransferRequest[] {
    const requests = [...this.pending.values()];
    this.pending.clear();
    return requests;
  }

  defer(request: FloorTransferRequest, floor: number, prepare: FloorPreparation): void {
    this.pending.set(request.slot.entity.id, request);
    if (this.preparations.has(floor)) return;
    const preparation = new Promise<GameSim>((resolve, reject) => {
      setImmediate(() => {
        void Promise.resolve().then(prepare).then(resolve, reject);
      });
    });
    this.preparations.set(floor, preparation);
    void preparation.then(
      () => this.preparations.delete(floor),
      () => this.preparations.delete(floor),
    );
  }

  async waitForPending(): Promise<void> {
    await Promise.all(this.preparations.values());
  }

  hasWorkForFloor(floor: number): boolean {
    return this.preparations.has(floor) || [...this.pending.values()].some((request) => request.targetFloor === floor);
  }
}
