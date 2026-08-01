import { ATTACK_TOUCH_BUTTON_SIZE, ORDINARY_TOUCH_BUTTON_SIZE, TOUCH_CONTROL_SCALE_LIMITS } from "../widgets/hud/touch/touchButtons.js";
import tuning from "../widgets/hud/touch/touchControlLayout.json" with { type: "json" };

export function touchControlSize(id: string): number | null {
  if (id === "touch-attack") return ATTACK_TOUCH_BUTTON_SIZE;
  if (id.startsWith("touch-")) return ORDINARY_TOUCH_BUTTON_SIZE;
  return id === "inventory-toggle" ? tuning.bagSize : null;
}

export function touchControlScale(radius: number, size: number, hudScale: number): number {
  const rawScale = (Math.max(1, radius) * 2) / (size * hudScale);
  return Math.min(TOUCH_CONTROL_SCALE_LIMITS.maximum, Math.max(TOUCH_CONTROL_SCALE_LIMITS.minimum, rawScale));
}

export function touchResizeOverride(
  pointer: { x: number; y: number },
  resize: { id: string; center: { x: number; y: number }; size: number },
  hudScale: number,
): { id: string; scale: number } {
  const radius = Math.hypot(pointer.x - resize.center.x, pointer.y - resize.center.y);
  return { id: resize.id, scale: touchControlScale(radius, resize.size, hudScale) };
}
