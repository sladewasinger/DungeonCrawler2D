import type { AdvancedSettingsDialog } from "./AdvancedSettingsDialog.js";


interface SessionMenuViewOptions {
  gear: HTMLButtonElement;

  overlay: HTMLDivElement;

  card: HTMLElement;

  primary: HTMLDivElement;

  confirmation: HTMLDivElement;

  advanced: AdvancedSettingsDialog;

  onOutsideClick: () => void;

}

export function configureSessionMenuView({ gear, overlay, card, primary, confirmation, advanced, onOutsideClick }: SessionMenuViewOptions): void {
  gear.setAttribute("aria-label", "Game menu");
  gear.setAttribute("aria-expanded", "false");

  overlay.dataset.sessionMenu = "true";

  overlay.setAttribute("role", "dialog");

  overlay.setAttribute("aria-modal", "true");

  overlay.setAttribute("aria-label", "Game menu");

  card.append(primary, confirmation, advanced.element);

  overlay.append(card);

  overlay.addEventListener("pointerdown", (event) => { if (event.target === overlay) onOutsideClick();

});

}
