const PAN_SPEED_PX_PER_SECOND = 420;
const TRACK_RESPONSE_MS = 70;
const PAN_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export interface SpectatorCameraPoint {
  readonly x: number;
  readonly y: number;
}

export class SpectatorCamera {
  private readonly held = new Set<string>();
  private center: SpectatorCameraPoint = { x: 0, y: 0 };
  private lastTarget: SpectatorCameraPoint = { x: 0, y: 0 };
  private initialized = false;
  private hasTarget = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", this.focusFirst, true);
    canvas.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    canvas.addEventListener("blur", this.clearHeld);
  }

  focus(): void {
    this.canvas.focus({ preventScroll: true });
  }

  reset(target: SpectatorCameraPoint): void {
    this.center = target;
    this.lastTarget = target;
    this.initialized = true;
    this.hasTarget = true;
    this.held.clear();
  }

  centerOnTarget(): void {
    if (this.hasTarget) this.reset(this.lastTarget);
  }

  update(
    target: SpectatorCameraPoint,
    deltaMs: number,
    free: boolean,
  ): SpectatorCameraPoint {
    this.lastTarget = target;
    this.hasTarget = true;
    if (!this.initialized || !free) return this.track(target, deltaMs);
    const seconds = Math.min(deltaMs, 100) / 1000;
    const x = this.axis("KeyD", "KeyA") * PAN_SPEED_PX_PER_SECOND * seconds;
    const y = this.axis("KeyS", "KeyW") * PAN_SPEED_PX_PER_SECOND * seconds;
    this.center = {
      x: this.center.x + x,
      y: this.center.y + y,
    };
    return this.center;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.focusFirst, true);
    this.canvas.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    this.canvas.removeEventListener("blur", this.clearHeld);
  }

  private track(target: SpectatorCameraPoint, deltaMs: number): SpectatorCameraPoint {
    const blend = this.initialized ? 1 - Math.exp(-deltaMs / TRACK_RESPONSE_MS) : 1;
    this.center = {
      x: this.center.x + (target.x - this.center.x) * blend,
      y: this.center.y + (target.y - this.center.y) * blend,
    };
    this.initialized = true;
    this.held.clear();
    return this.center;
  }

  private axis(positive: string, negative: string): number {
    return Number(this.held.has(positive)) - Number(this.held.has(negative));
  }

  private readonly focusFirst = (event: PointerEvent): void => {
    if (document.activeElement === this.canvas) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.focus();
  };

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (!PAN_KEYS.has(event.code)) return;
    event.preventDefault();
    this.held.add(event.code);
  };

  private readonly keyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly clearHeld = (): void => {
    this.held.clear();
  };
}
