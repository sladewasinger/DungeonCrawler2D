export interface GenerationPreviewRouteOverlay {
  readonly shown: boolean;
  dispose(): void;
}

export function createGenerationPreviewRouteOverlay(
  root: HTMLElement,
  redraw: () => void,
): GenerationPreviewRouteOverlay {
  const input = findRouteOverlay(root);
  input?.addEventListener("change", redraw);
  return {
    get shown() { return input?.checked ?? false; },
    dispose: () => input?.removeEventListener("change", redraw),
  };
}

function findRouteOverlay(root: HTMLElement): HTMLInputElement | null {
  if (typeof root.querySelector !== "function") return null;
  return root.querySelector<HTMLInputElement>("[data-admin-generation-routes]");
}
