/* eslint-disable max-lines -- gesture event handlers remain co-located for pointer-capture ownership. */
/** Implements drag, corner-resize, and touch-pinch gestures for one HUD window. */
import {
  isResizeHandle,
  resizeWindowFromPinch,
  resizeWindowFromPointer,
  type EditableHudWindow,
  type HudWindowEditingBinding,
  type HudWindowEditingContext,
  type HudWindowPoint,
} from "./HudWindowEditingGeometry.js";
import {
  pointDistance,
  pointerPoint,
  releaseGesturePointers,
  snapWindowAnchor,
  type DragGesture,
  type HudWindowGesture,
  type PinchGesture,
} from "./HudWindowGestureState.js";
import {
  applyHudWindowSize,
  hudWindowBounds,
  hudWindowSize,
  makeFreeHudWindow,
  moveHudWindow,
} from "./HudWindowGestureLayout.js";
import {
  createHudWindowResizeGrip,
  isHudWindowResizeGrip,
} from "./HudWindowResizeGrip.js";

export class HudWindowGestureController {
  private readonly grip = createHudWindowResizeGrip();
  private gesture: HudWindowGesture | null = null;

  constructor(
    private readonly record: EditableHudWindow,
    private readonly context: HudWindowEditingContext,
  ) {}

  bind(): HudWindowEditingBinding {
    this.record.element.append(this.grip);
    this.record.element.addEventListener("pointerdown", this.begin, true);
    this.record.element.addEventListener("pointermove", this.move);
    this.record.element.addEventListener("pointerup", this.end);
    this.record.element.addEventListener("pointercancel", this.end);
    return { setEditing: (editing) => this.setEditing(editing) };
  }

  private setEditing(editing: boolean): void {
    if (!editing) this.finish();
    this.grip.style.display = editing ? "block" : "none";
  }

  private readonly begin = (event: PointerEvent): void => {
    if (!this.context.editing()) return;
    const gripTarget = isHudWindowResizeGrip(event.target, this.grip);
    if (event.pointerType === "touch" && this.gesture) return this.beginPinch(event);
    if (this.gesture) return;
    event.preventDefault();
    event.stopPropagation();
    const root = makeFreeHudWindow(this.layoutRequest);
    this.context.raise(this.record);
    this.record.element.setPointerCapture(event.pointerId);
    if (gripTarget || this.pointerIsResizeHandle(event)) return this.beginResize(event);
    this.beginDrag(event, root);
  };

  private pointerIsResizeHandle(event: PointerEvent): boolean {
    return isResizeHandle({ rect: this.record.element.getBoundingClientRect(), point: pointerPoint(event) });
  }

  private beginResize(event: PointerEvent): void {
    this.gesture = {
      kind: "resize",
      pointerId: event.pointerId,
      origin: pointerPoint(event),
      point: pointerPoint(event),
      start: hudWindowSize(this.layoutRequest),
      bounds: hudWindowBounds(this.layoutRequest),
    };
  }

  private beginDrag(event: PointerEvent, root: DOMRect): void {
    const rect = this.record.element.getBoundingClientRect();
    this.gesture = {
      kind: "drag",
      pointerId: event.pointerId,
      offset: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      },
      point: pointerPoint(event),
      rootRect: root,
    };
  }

  private beginPinch(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const current = this.gesture;
    if (!current || current.kind === "pinch" || current.pointerId === event.pointerId) return;
    const points = new Map<number, HudWindowPoint>([
      [current.pointerId, current.point],
      [event.pointerId, pointerPoint(event)],
    ]);
    const first = points.get(current.pointerId);
    const second = points.get(event.pointerId);
    if (!first || !second) return;
    makeFreeHudWindow(this.layoutRequest);
    this.record.element.setPointerCapture(event.pointerId);
    this.gesture = {
      kind: "pinch",
      pointerIds: [current.pointerId, event.pointerId],
      points,
      startDistance: pointDistance(first, second),
      start: hudWindowSize(this.layoutRequest),
      bounds: hudWindowBounds(this.layoutRequest),
    };
  }

  private readonly move = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.kind === "pinch") return this.movePinch(gesture, event);
    if (event.pointerId !== gesture.pointerId) return;
    gesture.point = pointerPoint(event);
    if (gesture.kind === "resize") {
      return applyHudWindowSize({ ...this.layoutRequest, size: resizeWindowFromPointer(
        gesture.start,
        {
          x: (event.clientX - gesture.origin.x) / this.context.scale(),
          y: (event.clientY - gesture.origin.y) / this.context.scale(),
        },
        gesture.bounds,
      ) });
    }
    this.moveDrag(gesture, event);
  };

  private movePinch(gesture: PinchGesture, event: PointerEvent): void {
    if (!gesture.points.has(event.pointerId)) return;
    gesture.points.set(event.pointerId, pointerPoint(event));
    const [firstId, secondId] = gesture.pointerIds;
    const first = gesture.points.get(firstId);
    const second = gesture.points.get(secondId);
    if (first && second) {
      applyHudWindowSize({ ...this.layoutRequest, size: resizeWindowFromPinch({
        start: gesture.start,
        startDistance: gesture.startDistance,
        distance: pointDistance(first, second),
        bounds: gesture.bounds,
      }) });
    }
  }

  private moveDrag(gesture: DragGesture, event: PointerEvent): void {
    moveHudWindow({ ...this.layoutRequest, gesture, event });
  }

  private readonly end = (event: PointerEvent): void => {
    const gesture = this.gesture;
    const ownsPointer = gesture?.kind === "pinch" ? gesture.pointerIds.includes(event.pointerId) : gesture?.pointerId === event.pointerId;
    if (ownsPointer) this.finish();
  };

  private get layoutRequest(): { record: EditableHudWindow; context: HudWindowEditingContext } {
    return { record: this.record, context: this.context };
  }

  private finish(): void {
    const completed = this.gesture;
    if (!completed) return;
    releaseGesturePointers(this.record.element, completed);
    this.gesture = null;
    if (completed.kind === "drag" && !this.context.mobile) {
      snapWindowAnchor(
        this.record.layout,
        completed.rootRect,
      );
    }
    this.context.apply(this.record);
    this.context.persist();
  }
}
