export interface GenerationPreviewControlActions {
  readonly root: HTMLElement;
  readonly generate: HTMLButtonElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly status: HTMLElement;
}

export function createGenerationPreviewControlActions(): GenerationPreviewControlActions {
  const root = document.createElement("div");
  root.dataset.adminGenerationActions = "";
  const generate = action("Generate");
  generate.dataset.generationAction = "generate";
  const previous = action("Previous stage");
  previous.dataset.generationAction = "previous";
  const next = action("Next stage");
  next.dataset.generationAction = "next";
  const status = document.createElement("output");
  status.dataset.adminGenerationStatus = "";
  status.setAttribute("aria-live", "polite");
  status.textContent = "Choose Generate to build a local preview.";
  root.append(generate, previous, next, status);
  return { root, generate, previous, next, status };
}

function action(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
}
