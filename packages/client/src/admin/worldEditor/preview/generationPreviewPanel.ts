import { createGenerationPreviewControls, type GenerationPreviewDraft, type GenerationPreviewControls } from "../controls/generationPreviewControls.js";

export interface GenerationPreviewPanel {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly controls: GenerationPreviewControls;
  readonly hover: HTMLElement;
}

export interface GenerationPreviewPanelOptions {
  readonly draft?: GenerationPreviewDraft;
}

export function createGenerationPreviewPanel(
  options: GenerationPreviewPanelOptions = {},
): GenerationPreviewPanel {
  const root = document.createElement("div");
  root.dataset.adminGenerationPreview = "";
  const canvas = document.createElement("canvas");
  configurePreviewCanvas(canvas);
  const controls = createGenerationPreviewControls(options.draft);
  const routeOverlay = createRouteOverlayControl();
  const deltaOverlay = createDeltaOverlayControl();
  controls.root.append(routeOverlay, deltaOverlay);
  const hover = document.createElement("output");
  hover.dataset.adminGenerationHover = "";
  hover.setAttribute("aria-live", "polite");
  hover.textContent = "Hover a map cell for details.";
  const explanation = document.createElement("p");
  explanation.dataset.adminGenerationExplanation = "";
  explanation.textContent = "The trace and stage replay are local and read-only. World replacement is an authenticated operational action outside this editor.";
  root.append(controls.root, canvas, hover, explanation, legend());
  return {
    root,
    canvas,
    controls,
    hover,
  };
}

function createRouteOverlayControl(): HTMLLabelElement {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.adminGenerationRoutes = "";
  label.dataset.adminGenerationRoutesControl = "";
  label.append(input, " Show protected route debug overlay");
  return label;
}

function createDeltaOverlayControl(): HTMLLabelElement {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = true;
  input.dataset.adminGenerationDelta = "";
  label.dataset.adminGenerationDeltaControl = "";
  label.append(input, " Highlight changes from previous stage");
  return label;
}

function configurePreviewCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 800;
  canvas.height = 480;
  canvas.dataset.adminGenerationCanvas = "";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Finite dungeon generation stage preview");
}


function legend(): HTMLElement {
  const root = document.createElement("div");
  root.dataset.adminGenerationLegend = "";
  root.setAttribute("aria-label", "Generation preview legend");
  root.textContent = "Height brightness · regions tinted by territory · lime stage changes · gold Transition cells · cyan connector points · optional violet protected routes · ▧ room walls · · ordinary rooms · ● spawn · □ safe room · ◆ stairs · ▲ arenas · ▣ territory structures";
  return root;
}
