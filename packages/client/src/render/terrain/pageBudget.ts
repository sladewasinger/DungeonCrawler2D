export interface PageBudgetLimits {
  readonly activeBytes: number;
  readonly spareBytes: number;
}

export interface PageBudgetSnapshot extends PageBudgetLimits {
  readonly activeUsedBytes: number;
  readonly spareUsedBytes: number;
}

export class PageBudget {
  private activeUsed = 0;
  private spareUsed = 0;

  constructor(private readonly limits: PageBudgetLimits) {}

  activateNew(bytes: number): boolean {
    if (this.activeUsed + bytes > this.limits.activeBytes) return false;
    this.activeUsed += bytes;
    return true;
  }

  activateSpare(bytes: number): boolean {
    if (this.activeUsed + bytes > this.limits.activeBytes) return false;
    this.spareUsed -= bytes;
    this.activeUsed += bytes;
    return true;
  }

  releaseToSpare(bytes: number): boolean {
    this.activeUsed -= bytes;
    if (this.spareUsed + bytes > this.limits.spareBytes) return false;
    this.spareUsed += bytes;
    return true;
  }

  releaseAndDestroy(bytes: number): void {
    this.activeUsed -= bytes;
  }

  snapshot(): PageBudgetSnapshot {
    return {
      ...this.limits,
      activeUsedBytes: this.activeUsed,
      spareUsedBytes: this.spareUsed,
    };
  }
}
