import type { AdminMapScreenPoint } from "../adminMapCamera.js";
import { AdminMapPointerPan } from "./adminMapPointerPan.js";

export interface AdminMapCanvasInteractionOptions {
  readonly canvas: HTMLCanvasElement;
  readonly click: (event: MouseEvent) => void;
  readonly contextMenu: (event: MouseEvent) => void;
  readonly mouseMove: (event: MouseEvent) => void;
  readonly mouseLeave: () => void;
  readonly pointerDown: () => void;
  readonly pointerPan?: (delta: AdminMapScreenPoint) => void;
  readonly pointerPanStateChange?: (active: boolean) => void;
  readonly eventTarget?: EventTarget;
}

/** Owns all removable pointer listeners for one admin map canvas. */
export class AdminMapCanvasInteractions {
  private readonly pointerPan: AdminMapPointerPan;
  private readonly click = (event: MouseEvent) => {
    if (event.button === 1) return event.preventDefault();
    this.options.click(event);
  };
  private readonly contextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (event.button === 1) return;
    this.options.contextMenu(event);
  };
  private readonly auxClick = (event: MouseEvent) => {
    if (event.button === 1) event.preventDefault();
  };
  private readonly mouseMove = (event: MouseEvent) => this.options.mouseMove(event);
  private readonly mouseLeave = () => this.options.mouseLeave();
  private readonly pointerDown = (event: PointerEvent) => {
    this.pointerPan.start(event);
    this.options.pointerDown();
  };

  constructor(private readonly options: AdminMapCanvasInteractionOptions) {
    this.pointerPan = new AdminMapPointerPan({
      canvas: options.canvas,
      onPan: (delta) => options.pointerPan?.(delta),
      onStateChange: (active) => options.pointerPanStateChange?.(active),
      ...(options.eventTarget ? { eventTarget: options.eventTarget } : {}),
    });
    options.canvas.addEventListener("click", this.click);
    options.canvas.addEventListener("contextmenu", this.contextMenu);
    options.canvas.addEventListener("auxclick", this.auxClick);
    options.canvas.addEventListener("mousemove", this.mouseMove);
    options.canvas.addEventListener("mouseleave", this.mouseLeave);
    options.canvas.addEventListener("pointerdown", this.pointerDown);
  }

  dispose(): void {
    this.options.canvas.removeEventListener("click", this.click);
    this.options.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.options.canvas.removeEventListener("auxclick", this.auxClick);
    this.options.canvas.removeEventListener("mousemove", this.mouseMove);
    this.options.canvas.removeEventListener("mouseleave", this.mouseLeave);
    this.options.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.pointerPan.dispose();
  }
}
