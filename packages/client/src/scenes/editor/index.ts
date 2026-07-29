import { EditorScene } from "./EditorScene.js";

export { EditorScene };

export interface EditorBoot {
  readonly parentId: string;
}

export function setUpEditorLayout(): EditorBoot {
  const app = document.getElementById("app");
  if (!app) throw new Error("editor: #app host missing");
  app.replaceChildren(editorControls(), editorCanvasHost());
  app.style.cssText = "display:flex;gap:12px;padding:12px;background:#14141c";
  return { parentId: "editor-canvas" };
}

function editorControls(): HTMLDivElement {
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-direction:column;gap:8px;color:#fff";
  controls.append(button("Stairs", "editor-stairs"), button("Reset to zero", "editor-reset"));
  return controls;
}

function button(label: string, id: string): HTMLButtonElement {
  const control = document.createElement("button");
  control.id = id;
  control.textContent = label;
  return control;
}

function editorCanvasHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.id = "editor-canvas";
  host.style.cssText = "width:960px;height:960px;image-rendering:pixelated";
  return host;
}
