import type { AdminMapCenter } from "../adminMapCamera.js";

export interface AdminMapKeyboardPanOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onPan: (direction: AdminMapCenter, elapsedMs: number) => void;
  readonly eventTarget?: EventTarget;
}

const DIRECTIONS: Readonly<Record<string, AdminMapCenter>> = {
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
};

/** Smooth keyboard panning for a focused map canvas. */
export class AdminMapKeyboardPan {
  private readonly heldKeys = new Set<string>();
  private readonly eventTarget: EventTarget;
  private readonly onKeyDown = (event: Event) => this.handleKeyDown(event);
  private readonly onKeyUp = (event: Event) => this.handleKeyUp(event);
  private readonly onWindowBlur = () => this.release();
  private animationFrame: number | null = null;
  private previousAnimationAt: number | null = null;

  constructor(private readonly options: AdminMapKeyboardPanOptions) {
    this.eventTarget = options.eventTarget ?? window;
    this.eventTarget.addEventListener("keydown", this.onKeyDown);
    this.eventTarget.addEventListener("keyup", this.onKeyUp);
    this.eventTarget.addEventListener("blur", this.onWindowBlur);
  }

  dispose(): void {
    this.eventTarget.removeEventListener("keydown", this.onKeyDown);
    this.eventTarget.removeEventListener("keyup", this.onKeyUp);
    this.eventTarget.removeEventListener("blur", this.onWindowBlur);
    this.release();
  }

  private handleKeyDown(event: Event): void {
    const key = normalizedMapKey(keyFromEvent(event));
    if (!key || document.activeElement !== this.options.canvas) return;
    event.preventDefault();
    this.heldKeys.add(key);
    this.beginPanning();
  }

  private handleKeyUp(event: Event): void {
    const key = normalizedMapKey(keyFromEvent(event));
    if (key) this.heldKeys.delete(key);
  }

  private beginPanning(): void {
    if (this.animationFrame !== null) return;
    this.animationFrame = requestAnimationFrame((now) => this.panFrame(now));
  }

  private panFrame(now: number): void {
    this.animationFrame = null;
    const previous = this.previousAnimationAt ?? now;
    this.previousAnimationAt = now;
    if (this.heldKeys.size === 0) return this.stopPanning();
    this.options.onPan(heldDirection(this.heldKeys), now - previous);
    this.animationFrame = requestAnimationFrame((next) => this.panFrame(next));
  }

  private stopPanning(): void {
    this.previousAnimationAt = null;
  }

  private release(): void {
    this.heldKeys.clear();
    this.previousAnimationAt = null;
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }
}

function normalizedMapKey(key: unknown): string | null {
  if (typeof key !== "string") return null;
  const normalized = key.toLowerCase();
  return DIRECTIONS[normalized] ? normalized : null;
}

function keyFromEvent(event: Event): unknown {
  return "key" in event ? event.key : undefined;
}

function heldDirection(keys: ReadonlySet<string>): AdminMapCenter {
  return [...keys].reduce((total, key) => {
    const direction = DIRECTIONS[key]!;
    return { x: total.x + direction.x, y: total.y + direction.y };
  }, { x: 0, y: 0 });
}
