// Editor bootstrap: builds the split DOM layout (paint panel left, Phaser render
// right), wires the shared store into both, and hands the Phaser config back to
// main.ts. The right panel is the REAL game renderer — that is the whole point.
import { EditorScene } from "./EditorScene.js";
import { EDITOR_RENDER_VIEWPORT_PX } from "./editorCameraLayout.js";
import { EditorStore } from "./editorStore.js";
import { buildPaintPanel } from "./paintPanel/index.js";

export { EditorScene };

export interface EditorBoot {
  readonly store: EditorStore;
  readonly parentId: string;
  /** LANE W3: lets EditorScene's render-panel pointer handling share the data grid's
   * own repaint + inspector readout, so painting/hovering either panel stays in sync. */
  readonly refreshGrid: () => void;
  readonly setInspectorText: (text: string) => void;
}

/** Splits #app into panel + canvas hosts and returns what main.ts needs to boot Phaser. */
export function setUpEditorLayout(): EditorBoot {
  const app = document.getElementById("app");
  if (!app) throw new Error("editor: #app host missing");
  document.documentElement.style.height = "auto";
  document.documentElement.style.minHeight = "100%";
  document.documentElement.style.overflow = "auto";
  document.body.style.height = "auto";
  document.body.style.minHeight = "100%";
  document.body.style.overflow = "auto";
  app.style.cssText =
    "box-sizing:border-box;display:flex;gap:12px;align-items:flex-start;" +
    "width:max-content;min-width:100%;height:auto;min-height:100vh;min-height:100dvh;" +
    "overflow:visible;padding:12px;background:#14141c";

  const left = document.createElement("div");
  left.style.cssText =
    "display:flex;flex:0 0 544px;width:544px;min-width:0;flex-direction:column;align-items:flex-start";
  const right = document.createElement("div");
  right.id = "editor-canvas";
  right.style.cssText =
    `flex:0 0 ${EDITOR_RENDER_VIEWPORT_PX}px;width:${EDITOR_RENDER_VIEWPORT_PX}px;` +
    `height:${EDITOR_RENDER_VIEWPORT_PX}px;image-rendering:pixelated`;
  app.append(left, right);

  const store = new EditorStore();
  const panel = buildPaintPanel(left, store);
  return { store, parentId: right.id, refreshGrid: panel.refresh, setInspectorText: panel.setInspectorText };
}
