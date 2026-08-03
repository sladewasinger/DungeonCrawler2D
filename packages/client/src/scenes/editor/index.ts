import { EditorScene } from "./EditorScene.js";
import { createGenerationPreviewPanel, type GenerationPreviewPanel } from "../../admin/worldEditor/preview/generationPreviewPanel.js";
import { GenerationPreviewController } from "../../admin/worldEditor/preview/generationPreviewController.js";
import { createEditorHeightmapSurface, type EditorHeightmapSurface } from "./editorHeightmapSurface.js";
import { createEditorFileControls, type EditorFileControls } from "./editorFileControls.js";

export { EditorScene };

export interface EditorBoot {
  readonly parentId: string;
  readonly heightmap: EditorHeightmapSurface;
  readonly generationPreview: GenerationPreviewPanel;
  readonly generationPreviewController: GenerationPreviewController;
  readonly fileControls: EditorFileControls;
  dispose(): void;
}

export function setUpEditorLayout(): EditorBoot {
  const app = document.getElementById("app");
  if (!app) throw new Error("editor: #app host missing");
  const heightmap = createEditorHeightmapSurface();
  const generationPreview = createGenerationPreviewPanel();
  const generationPreviewController = new GenerationPreviewController({
    controls: generationPreview.controls,
    canvas: generationPreview.canvas,
    hover: generationPreview.hover,
  });
  const fileControls = createEditorFileControls(heightmap);
  const mapEditor = editorMapEditor(heightmap, fileControls);
  const tabs = editorTabs(generationPreview.root, mapEditor);
  app.replaceChildren(tabs);
  app.style.cssText = "min-height:100vh;padding:12px;background:#14141c;color:#fff";
  return {
    parentId: "editor-canvas", heightmap, generationPreview,
    generationPreviewController, fileControls,
    dispose: () => {
      generationPreviewController.dispose();
      heightmap.dispose();
      fileControls.dispose();
    },
  };
}

function editorControls(): HTMLDivElement {
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-direction:column;gap:8px;color:#fff";
  const heading = document.createElement("strong");
  heading.textContent = "Finite-floor map and fixture editor";
  const notice = document.createElement("p");
  notice.textContent = "Localhost-only editor · left/right heightmap editing · middle-drag pan · wheel zoom.";
  const status = document.createElement("output");
  status.id = "editor-status";
  status.textContent = "Loading finite floor 1…";
  status.setAttribute("aria-live", "polite");
  controls.append(heading, notice, status, toolButtons(), button("Reset edits", "editor-reset"));
  return controls;
}

function toolButtons(): HTMLElement {
  const tools = document.createElement("div");
  tools.dataset.editorTools = "";
  for (const [tool, label] of [["floor", "Floor"], ["wall", "Wall"], ["door", "Door"], ["stairs", "Stairs"], ["safe", "Safe"], ["spawn", "Spawn"], ["arena", "Arena"], ["feature", "Feature"]] as const) {
    const control = button(label, `editor-tool-${tool}`);
    control.dataset.editorTool = tool;
    tools.append(control);
  }
  return tools;
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

function editorMapEditor(heightmap: EditorHeightmapSurface, fileControls: EditorFileControls): HTMLElement {
  const root = document.createElement("div");
  root.dataset.editorMapEditor = "";
  const controls = editorControls();
  const fileBar = document.createElement("div");
  fileBar.append(fileControls.exportButton, fileControls.importButton);
  const panels = document.createElement("div");
  panels.dataset.editorMapPanels = "";
  panels.style.cssText = "display:grid;grid-template-columns:minmax(320px,1fr) minmax(480px,2fr);gap:12px;align-items:start";
  const scene = editorCanvasHost();
  panels.append(heightmap.root, scene);
  root.append(controls, fileBar, panels);
  const narrowStyle = document.createElement("style");
  narrowStyle.textContent = "@media (max-width: 900px){[data-editor-map-panels]{grid-template-columns:1fr!important}}";
  root.append(narrowStyle);
  return root;
}

function editorTabs(preview: HTMLElement, mapEditor: HTMLElement): HTMLElement {
  const root = document.createElement("main");
  root.dataset.editorLayout = "";
  const tabs = document.createElement("nav");
  tabs.dataset.editorTabs = "";
  const previewButton = button("Generation preview", "editor-preview-tab");
  const mapButton = button("Map editor", "editor-map-tab");
  const previewPanel = tabPanel("generation-preview", preview);
  const mapPanel = tabPanel("map-editor", mapEditor);
  tabs.append(previewButton, mapButton);
  root.append(tabs, previewPanel, mapPanel);
  const select = (previewSelected: boolean): void => {
    previewPanel.hidden = !previewSelected;
    mapPanel.hidden = previewSelected;
    previewButton.setAttribute("aria-selected", String(previewSelected));
    mapButton.setAttribute("aria-selected", String(!previewSelected));
  };
  previewButton.addEventListener("click", () => select(true));
  mapButton.addEventListener("click", () => select(false));
  select(false);
  return root;
}

function tabPanel(id: string, content: HTMLElement): HTMLElement {
  const panel = document.createElement("section");
  panel.id = `editor-${id}-panel`;
  panel.dataset.editorPanel = id;
  panel.append(content);
  return panel;
}
