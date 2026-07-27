/** Builds the full-screen inventory shell independently from inventory state and actions. */
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export type InventoryTab = "all" | "weapons" | "usables" | "materials";
export type InventoryFolder = "all" | "equipped" | "hotbar";

const TABS: readonly InventoryTab[] = ["all", "weapons", "usables", "materials"];
const FOLDERS: ReadonlyArray<{ id: InventoryFolder; label: string }> = [
  { id: "all", label: "All items" },
  { id: "equipped", label: "Equipped" },
  { id: "hotbar", label: "Hotbar" },
];

export interface InventoryShellCallbacks {
  close(): void;
  selectTab(tab: InventoryTab): void;
  selectFolder(folder: InventoryFolder): void;
  search(): void;
}

export interface InventoryShell {
  element: HTMLDivElement;
  tabs: HTMLElement;
  folders: HTMLElement;
  search: HTMLInputElement;
  list: HTMLDivElement;
  summary: HTMLSpanElement;
}

interface NavigationButtonInput {
  label: string;
  dataKey: "inventoryTab" | "inventoryFolder";
  id: string;
  action: () => void;
}

const navigationButton = ({ label, dataKey, id, action }: NavigationButtonInput): HTMLButtonElement => {
  const button = createHudTemplate<HTMLButtonElement>("hud-inventory-button-template");
  button.textContent = label;
  button.addEventListener("click", action);
  button.dataset[dataKey] = id;
  return button;
};

const navigation = (
  callbacks: InventoryShellCallbacks,
): { tabs: HTMLElement; folders: HTMLElement } => {
  const tabs = document.createElement("nav");
  tabs.append(...TABS.map((tab) =>
    navigationButton({ label: tab, dataKey: "inventoryTab", id: tab, action: () => callbacks.selectTab(tab) })));
  const folders = document.createElement("nav");
  folders.append(...FOLDERS.map((folder) => {
    const button = navigationButton({
      label: folder.label,
      dataKey: "inventoryFolder",
      id: folder.id,
      action: () => callbacks.selectFolder(folder.id),
    });
    button.dataset.align = "left";
    return button;
  }));
  return { tabs, folders };
};

export const createInventoryShell = (
  callbacks: InventoryShellCallbacks,
): InventoryShell => {
  const element = createHudTemplate<HTMLDivElement>("hud-inventory-template");
  const tabs = requireHudElement<HTMLElement>(element, "[data-hud-inventory-tabs]");
  const folders = requireHudElement<HTMLElement>(element, "[data-hud-inventory-folders]");
  const list = requireHudElement<HTMLDivElement>(element, "[data-hud-inventory-list]");
  const search = requireHudElement<HTMLInputElement>(element, "[data-hud-inventory-search]");
  const summary = requireHudElement<HTMLSpanElement>(element, "[data-hud-inventory-summary]");
  const closeButton = requireHudElement<HTMLButtonElement>(element, "[data-hud-inventory-close]");
  closeButton.addEventListener("click", callbacks.close);
  const navigationViews = navigation(callbacks);
  tabs.replaceChildren(...Array.from(navigationViews.tabs.children));
  folders.replaceChildren(...Array.from(navigationViews.folders.children));
  search.addEventListener("input", callbacks.search);
  return {
    element, tabs, folders, search, list, summary,
  };
};
