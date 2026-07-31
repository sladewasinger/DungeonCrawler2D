/** Keeps a map's focus click from also triggering a placement action. */
export class AdminMapClickFocusGuard {
  private pendingAction: MapPointerAction | null = null;

  pointerDown(input: AdminMapPointerDown): void {
    this.pendingAction = input.wasFocused ? null : pointerAction(input.button);
  }

  consumeClick(): boolean {
    return this.consume("click");
  }

  consumeContextMenu(): boolean {
    return this.consume("contextmenu");
  }

  private consume(action: MapPointerAction): boolean {
    if (this.pendingAction !== action) return false;
    this.pendingAction = null;
    return true;
  }
}

export interface AdminMapPointerDown {
  readonly button: number;
  readonly wasFocused: boolean;
}

type MapPointerAction = "click" | "contextmenu";

function pointerAction(button: number): MapPointerAction | null {
  if (button === 0) return "click";
  if (button === 2) return "contextmenu";
  return null;
}
