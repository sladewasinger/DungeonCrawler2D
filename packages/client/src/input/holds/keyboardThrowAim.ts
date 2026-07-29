export interface ThrowAimPress {
  readonly throwableSelected: boolean;
  readonly allowDebug: boolean;
  readonly onDebug: () => void;
}

export interface ThrowAimRelease {
  readonly allowThrow: boolean;
  readonly onThrow: () => void;
}

/** Owns the G-key edge contract: selection starts a preview on press and throws
 * exactly once on release; repeat key-down events cannot restart or fire it. */
export class KeyboardThrowAim {
  private aiming = false;

  press(request: ThrowAimPress): void {
    if (this.aiming) return;
    if (!request.throwableSelected) {
      if (request.allowDebug) request.onDebug();
      return;
    }
    this.aiming = true;
  }

  release(request: ThrowAimRelease): void {
    if (!this.aiming) return;
    this.aiming = false;
    if (request.allowThrow) request.onThrow();
  }

  active(): boolean {
    return this.aiming;
  }
}
