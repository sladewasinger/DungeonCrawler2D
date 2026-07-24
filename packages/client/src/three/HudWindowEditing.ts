/** Binds explicit edit gestures to a HUD window. */
import { HudWindowGestureController } from "./HudWindowGestureController.js";
import type {
  EditableHudWindow,
  HudWindowEditingBinding,
  HudWindowEditingContext,
} from "./HudWindowEditingGeometry.js";

export * from "./HudWindowEditingGeometry.js";

export const bindHudWindowEditing = (
  record: EditableHudWindow,
  context: HudWindowEditingContext,
): HudWindowEditingBinding => new HudWindowGestureController(record, context).bind();
