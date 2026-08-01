import type { AdminMapScreenPoint } from "../adminMapCamera.js";

export interface AdminMapPointerPanOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onPan: (delta: AdminMapScreenPoint) => void;
  readonly onStateChange?: (active: boolean) => void;
  readonly eventTarget?: EventTarget;
}

/** Owns the middle-button pointer gesture used to pan the admin map. */
export class AdminMapPointerPan {
  private readonly eventTarget: EventTarget;
  private activePointerId: number | null = null;
  private lastClientPoint: AdminMapScreenPoint | null = null;
  private readonly onPointerMove = (event: Event) => this.handlePointerMove(event);
  private readonly onPointerUp = (event: Event) => this.release(event);
  private readonly onPointerCancel = (event: Event) => this.release(event);
  private readonly onLostPointerCapture = (event: Event) => this.release(event);
  private readonly onWindowBlur = () => this.release();

  constructor(private readonly options: AdminMapPointerPanOptions) {
    this.eventTarget = options.eventTarget ?? defaultEventTarget(options.canvas);
    options.canvas.addEventListener("pointermove", this.onPointerMove);
    options.canvas.addEventListener("pointerup", this.onPointerUp);
    options.canvas.addEventListener("pointercancel", this.onPointerCancel);
    options.canvas.addEventListener("lostpointercapture", this.onLostPointerCapture);
    this.eventTarget.addEventListener("blur", this.onWindowBlur);
  }

  start(event: PointerEvent): void {
    if (event.button !== 1) return;
    event.preventDefault();
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.lastClientPoint = clientPoint(event);
    this.options.canvas.setPointerCapture?.(event.pointerId);
    this.options.onStateChange?.(true);
  }

  dispose(): void {
    this.release();
    this.options.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.options.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.options.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.options.canvas.removeEventListener("lostpointercapture", this.onLostPointerCapture);
    this.eventTarget.removeEventListener("blur", this.onWindowBlur);
  }

  private handlePointerMove(rawEvent: Event): void {
    const event = rawEvent as PointerEvent;
    if (!this.ownsPointer(event) || !this.lastClientPoint) return;
    const nextPoint = clientPoint(event);
    const delta = subtractPoints(nextPoint, this.lastClientPoint);
    this.lastClientPoint = nextPoint;
    if (delta.x === 0 && delta.y === 0) return;
    event.preventDefault();
    this.options.onPan(delta);
  }

  private release(rawEvent?: Event): void {
    if (this.activePointerId === null) return;
    const eventPointerId = rawEvent ? pointerId(rawEvent) : null;
    if (eventPointerId !== null && eventPointerId !== this.activePointerId) return;
    const releasedPointerId = this.activePointerId;
    this.activePointerId = null;
    this.lastClientPoint = null;
    releasePointerCapture(this.options.canvas, releasedPointerId);
    this.options.onStateChange?.(false);
  }

  private ownsPointer(event: PointerEvent): boolean {
    return this.activePointerId === event.pointerId;
  }
}

function clientPoint(event: PointerEvent): AdminMapScreenPoint {
  return { x: event.clientX, y: event.clientY };
}

function subtractPoints(
  next: AdminMapScreenPoint,
  previous: AdminMapScreenPoint,
): AdminMapScreenPoint {
  return { x: next.x - previous.x, y: next.y - previous.y };
}

function pointerId(event: Event): number | null {
  if (!("pointerId" in event) || typeof event.pointerId !== "number") return null;
  return event.pointerId;
}

function releasePointerCapture(canvas: HTMLCanvasElement, pointerId: number): void {
  if (typeof canvas.releasePointerCapture !== "function") return;
  if (canvas.hasPointerCapture && !canvas.hasPointerCapture(pointerId)) return;
  canvas.releasePointerCapture(pointerId);
}

function defaultEventTarget(canvas: HTMLCanvasElement): EventTarget {
  return typeof window === "undefined" ? canvas : window;
}
