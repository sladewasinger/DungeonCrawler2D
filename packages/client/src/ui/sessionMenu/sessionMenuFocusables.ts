import type { AdvancedSettingsDialog } from "./AdvancedSettingsDialog.js";

export const activeFocusables = (
  advanced: AdvancedSettingsDialog,
  confirmation: HTMLElement,
  primary: HTMLElement,
): HTMLElement[] => {
  const container = advanced.isOpen
    ? advanced.element
    : confirmation.style.display === "grid" ? confirmation : primary;
  return Array.from(container.querySelectorAll<HTMLElement>(
    "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])",
  )).filter((element) => !element.hidden && element.tabIndex >= 0 && element.getClientRects().length > 0);
};
