import type { Connection } from "../../../net/connection/connection.js";

export interface WorldLoadingOverlay {
  sync(worldReady: boolean): void;
  dispose(): void;
}

export type WorldLoadingState =
  | { readonly kind: "hidden" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string };

export function initialWorldLoadingState(input: {
  readonly worldReady: boolean;
  readonly worldLoading: boolean;
  readonly worldLoadError: string | null;
}): WorldLoadingState {
  if (input.worldReady) return { kind: "hidden" };
  if (input.worldLoadError) return { kind: "error", message: input.worldLoadError };
  return input.worldLoading ? { kind: "loading" } : { kind: "hidden" };
}

export function createWorldLoadingOverlay(
  connection: Connection,
  root: HTMLElement,
): WorldLoadingOverlay {
  const element = createLoadingElement(root);
  const callbacks = bindLoadingCallbacks(connection, element);
  showInitialLoadingState(connection, callbacks);
  return {
    sync: (worldReady) => {
      if (worldReady) element.style.display = "none";
    },
    dispose: () => {
      if (connection.onWorldLoading === callbacks.showLoading) connection.onWorldLoading = callbacks.previousLoading;
      if (connection.onWorldLoadError === callbacks.showError) connection.onWorldLoadError = callbacks.previousError;
      element.remove();
    },
  };
}

function showInitialLoadingState(
  connection: Connection,
  callbacks: LoadingCallbacks,
): void {
  const state = initialWorldLoadingState(connection);
  if (state.kind === "error") callbacks.showError(state.message);
  if (state.kind === "loading") callbacks.showLoading();
}

function createLoadingElement(root: HTMLElement): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("role", "status");
  element.style.cssText = [
    "position:fixed", "inset:0", "z-index:1000", "display:none", "place-items:center",
    "background:rgba(7,8,13,.86)", "color:#ffd23d", "font:24px monogram,monospace",
    "pointer-events:auto",
  ].join(";");
  root.append(element);
  return element;
}

function bindLoadingCallbacks(connection: Connection, element: HTMLDivElement): LoadingCallbacks {
  const previousLoading = connection.onWorldLoading;
  const previousError = connection.onWorldLoadError;
  const showLoading = (): void => {
    previousLoading?.(); element.textContent = "Loading dungeon…"; element.style.display = "grid";
  };
  const showError = (message: string): void => {
    previousError?.(message); element.textContent = `Dungeon loading failed: ${message}`; element.style.display = "grid";
  };
  connection.onWorldLoading = showLoading;
  connection.onWorldLoadError = showError;
  return { previousLoading, previousError, showLoading, showError };
}

interface LoadingCallbacks {
  readonly previousLoading: Connection["onWorldLoading"];
  readonly previousError: Connection["onWorldLoadError"];
  readonly showLoading: () => void;
  readonly showError: (message: string) => void;
}
