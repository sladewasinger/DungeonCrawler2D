/**
 * Shared mutable state for edit-HUD mode: whether it's active and which widget (if
 * any) is currently mid-drag. One instance lives on the `HudEditMode` facade
 * (index.ts) — every sibling module in this folder takes it as a plain argument
 * instead of holding its own copy.
 */

export interface DragState {
  widgetId: string;
  /** Pointer position minus the widget's screen position at drag start, so the
   * widget doesn't jump to re-center under the cursor on the very first move event. */
  grabOffset: { x: number; y: number };
}

export interface HudEditState {
  active: boolean;
  drag: DragState | null;
}

export function createHudEditState(): HudEditState {
  return { active: false, drag: null };
}
