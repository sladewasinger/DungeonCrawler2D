/** Client-side revision ledger for negotiated snapshot deltas. */
export class SnapshotRevisionState {
  tick: number | null = null;
  inventory = -1;
  hotbar = -1;
  readonly entities = new Map<string, number>();
  awaitingBaseline = true;
  resyncPending = false;

  reset(): void {
    this.tick = null;
    this.inventory = -1;
    this.hotbar = -1;
    this.entities.clear();
    this.awaitingBaseline = true;
    this.resyncPending = false;
  }
}
