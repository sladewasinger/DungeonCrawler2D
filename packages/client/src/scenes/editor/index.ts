// Editor bootstrap: builds the split DOM layout (paint panel left, Phaser render
// right), wires the shared store into both, and hands the Phaser config back to
// main.ts. The right panel is the REAL game renderer — that is the whole point.
import { EditorScene } from "./EditorScene.js";
import { EditorStore } from "./editorStore.js";
import { buildPaintPanel } from "./paintPanel.js";

export { EditorScene };

export interface EditorBoot {
  readonly store: EditorStore;
  readonly parentId: string;
}

/** Splits #app into panel + canvas hosts and returns what main.ts needs to boot Phaser. */
export function setUpEditorLayout(): EditorBoot {
  const app = document.getElementById("app");
  if (!app) throw new Error("editor: #app host missing");
  app.style.cssText = "display:flex;gap:12px;align-items:flex-start;padding:12px;background:#14141c";

  const left = document.createElement("div");
  left.style.cssText = "flex:0 0 auto";
  const right = document.createElement("div");
  right.id = "editor-canvas";
  right.style.cssText = "flex:0 0 auto;image-rendering:pixelated";
  app.append(left, right);

  const store = new EditorStore();
  buildPaintPanel(left, store);
  return { store, parentId: right.id };
}
