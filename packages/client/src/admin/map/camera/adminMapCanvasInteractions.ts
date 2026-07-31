export interface AdminMapCanvasInteractionOptions {
  readonly canvas: HTMLCanvasElement;
  readonly click: (event: MouseEvent) => void;
  readonly contextMenu: (event: MouseEvent) => void;
  readonly mouseMove: (event: MouseEvent) => void;
  readonly mouseLeave: () => void;
  readonly pointerDown: () => void;
}

/** Owns all removable pointer listeners for one admin map canvas. */
export class AdminMapCanvasInteractions {
  private readonly click = (event: MouseEvent) => this.options.click(event);
  private readonly contextMenu = (event: MouseEvent) => this.options.contextMenu(event);
  private readonly mouseMove = (event: MouseEvent) => this.options.mouseMove(event);
  private readonly mouseLeave = () => this.options.mouseLeave();
  private readonly pointerDown = () => this.options.pointerDown();

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
}
