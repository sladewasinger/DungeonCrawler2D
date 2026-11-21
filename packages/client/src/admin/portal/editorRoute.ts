import { startEditorPhaserRoute } from "../../phaser/EditorPhaserRoute.js";
import "../styles/adminTheme.css";
import { isEditorRoute } from "./editorRoutePredicate.js";

export { isEditorRoute } from "./editorRoutePredicate.js";

export function startEditorRoute(): void {
  if (!isEditorRoute()) return;
  startEditorPhaserRoute();
}
