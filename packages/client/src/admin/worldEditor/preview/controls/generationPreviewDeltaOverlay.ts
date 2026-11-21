export interface GenerationPreviewDeltaOverlay {
  readonly shown: boolean;
  dispose(): void;
}

export function createGenerationPreviewDeltaOverlay(
  root: HTMLElement,
  redraw: () => void,
): GenerationPreviewDeltaOverlay {
  const input = findDeltaOverlay(root);
  input?.addEventListener("change", redraw);
  return {
    get shown() { return input?.checked ?? false; },
    dispose: () => input?.removeEventListener("change", redraw),
  };
}

function findDeltaOverlay(root: HTMLElement): HTMLInputElement | null {
  if (typeof root.querySelector !== "function") return null;
  return root.querySelector<HTMLInputElement>("[data-admin-generation-delta]");
}
