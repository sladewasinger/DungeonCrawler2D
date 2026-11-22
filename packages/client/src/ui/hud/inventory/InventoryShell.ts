/** Builds the full-screen inventory shell independently from inventory state and actions. */
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export interface InventoryShellCallbacks {
  close(): void;
}

export interface InventoryShell {
  element: HTMLDivElement;
  list: HTMLDivElement;
  summary: HTMLSpanElement;
}

export const createInventoryShell = (
  callbacks: InventoryShellCallbacks,
): InventoryShell => {
  const element = createHudTemplate<HTMLDivElement>("hud-inventory-template");
  const list = requireHudElement<HTMLDivElement>(element, "[data-hud-inventory-list]");
  const summary = requireHudElement<HTMLSpanElement>(element, "[data-hud-inventory-summary]");
  const closeButton = requireHudElement<HTMLButtonElement>(element, "[data-hud-inventory-close]");
  closeButton.addEventListener("click", callbacks.close);
  return { element, list, summary };
};
