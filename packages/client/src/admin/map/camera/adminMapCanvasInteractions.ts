import { AdminMapClickFocusGuard } from "./adminMapClickFocusGuard.js";

export interface AdminMapCanvasInteractionOptions {
  readonly canvas: HTMLCanvasElement;
  readonly click: (event: MouseEvent) => void;
  readonly contextMenu: (event: MouseEvent) => void;
  readonly mouseMove: (event: MouseEvent) => void;
  readonly mouseLeave: () => void;
  readonly pointerDown: () => void;
  readonly isFocused?: () => boolean;
}

/** Owns all removable pointer listeners for one admin map canvas. */
export class AdminMapCanvasInteractions {
  private readonly clickFocusGuard = new AdminMapClickFocusGuard();
  private readonly click = (event: MouseEvent) => {
    if (this.clickFocusGuard.consumeClick()) {
      event.preventDefault();
      return;
    }
    this.options.click(event);
  };
  private readonly contextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (this.clickFocusGuard.consumeContextMenu()) return;
    this.options.contextMenu(event);
  };
  private readonly mouseMove = (event: MouseEvent) => this.options.mouseMove(event);
  private readonly mouseLeave = () => this.options.mouseLeave();
  private readonly pointerDown = (event: PointerEvent) => {
    const button = pointerButton(event);
    this.clickFocusGuard.pointerDown({
      button,
      wasFocused: isMapActionButton(button) ? this.isFocused() : true,
    });
    this.options.pointerDown();
  };

  constructor(private readonly options: AdminMapCanvasInteractionOptions) {
    options.canvas.addEventListener("click", this.click);
    options.canvas.addEventListener("contextmenu", this.contextMenu);
    options.canvas.addEventListener("mousemove", this.mouseMove);
    options.canvas.addEventListener("mouseleave", this.mouseLeave);
    options.canvas.addEventListener("pointerdown", this.pointerDown);
  }

  dispose(): void {
    this.options.canvas.removeEventListener("click", this.click);
    this.options.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.options.canvas.removeEventListener("mousemove", this.mouseMove);
    this.options.canvas.removeEventListener("mouseleave", this.mouseLeave);
    this.options.canvas.removeEventListener("pointerdown", this.pointerDown);
  }

  private isFocused(): boolean {
    return this.options.isFocused?.() ?? document.activeElement === this.options.canvas;
  }
}

function pointerButton(event: PointerEvent): number {
  return typeof event.button === "number" ? event.button : -1;
}

function isMapActionButton(button: number): boolean {
  return button === 0 || button === 2;
}
