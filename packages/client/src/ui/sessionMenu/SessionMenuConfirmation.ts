import { createSessionButton } from "./SessionMenuControls.js";

export interface SessionMenuConfirmation {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly action: () => void;
}

interface ConfirmationViewOptions {
  readonly container: HTMLElement;
  readonly primary: HTMLElement;
  readonly value: SessionMenuConfirmation;
  readonly returnFocus?: HTMLElement | undefined;
  readonly fallbackFocus?: HTMLElement | undefined;
}

export const respawnConfirmation = (
  action: () => void,
): SessionMenuConfirmation => ({
  title: "Respawn?",
  detail: "This kills your crawler. You will lose your current position.",
  actionLabel: "Confirm respawn",
  action,
});

export const quitConfirmation = (
  action: () => void,
): SessionMenuConfirmation => ({
  title: "Quit to title?",
  detail: "Your crawler disconnects before the title screen returns.",
  actionLabel: "Confirm quit",
  action,
});

export function showSessionMenuConfirmation(
  options: ConfirmationViewOptions,
): HTMLButtonElement {
  const title = document.createElement("h2");
  title.textContent = options.value.title;
  title.style.cssText = "margin:0;color:#ffd54c;font-size:18px";
  const detail = document.createElement("p");
  detail.textContent = options.value.detail;
  detail.style.cssText = "margin:0;line-height:1.45;color:#d8d5df";
  const confirm = createSessionButton(
    options.value.actionLabel,
    options.value.action,
  );
  confirm.style.borderColor = "#c45d65";
  const cancel = createSessionButton("Cancel", () => cancelConfirmation(options));
  options.container.replaceChildren(title, detail, confirm, cancel);
  options.primary.style.display = "none";
  options.container.style.display = "grid";
  return cancel;
}

function cancelConfirmation(options: ConfirmationViewOptions): void {
  options.container.style.display = "none";
  options.primary.style.display = "grid";
  const destination = options.returnFocus?.isConnected ? options.returnFocus : options.fallbackFocus;
  destination?.focus({ preventScroll: true });
}
