/** Builds the full-screen inventory shell independently from inventory state and actions. */
import {
  HUD_PANEL,
  createHudButton,
} from "../styles/HudStyles.js";
import { createInventoryContent } from "./InventoryShellContent.js";

export type InventoryTab = "all" | "weapons" | "usables" | "materials";
export type InventoryFolder = "all" | "equipped" | "hotbar";

const TABS: readonly InventoryTab[] = ["all", "weapons", "usables", "materials"];
const INVENTORY_LABEL = "Inventory";
const ARIA_LABEL = "aria-label";
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
  tabs: HTMLDivElement;
  folders: HTMLElement;
  search: HTMLInputElement;
  list: HTMLDivElement;
  summary: HTMLSpanElement;
}

const workspace = (): { element: HTMLDivElement; shell: HTMLElement } => {
  const element = document.createElement("div");
  element.hidden = true;
  element.dataset.inventoryWorkspace = "true";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-modal", "true");
  element.setAttribute(ARIA_LABEL, INVENTORY_LABEL);
  element.style.cssText =
    "position:absolute;inset:0;z-index:2400;display:none;place-items:center;" +
    "padding:clamp(10px,4vw,48px);box-sizing:border-box;pointer-events:auto;" +
    "touch-action:pan-y;background:rgba(7,8,14,.82);text-shadow:none";
  const shell = document.createElement("section");
  shell.style.cssText =
    `${HUD_PANEL};width:min(100%,960px);height:min(100%,720px);` +
    "display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;" +
    "background:rgba(17,18,29,.96);box-shadow:0 18px 60px rgba(0,0,0,.62)";
  element.append(shell);
  return { element, shell };
};

const header = (
  summary: HTMLElement,
  close: () => void,
): HTMLDivElement => {
  const element = document.createElement("div");
  element.style.cssText =
    "display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px";
  const title = document.createElement("strong");
  title.textContent = INVENTORY_LABEL;
  title.style.cssText = "font-size:17px;letter-spacing:.08em";
  const closeButton = createHudButton("close", close);
  closeButton.setAttribute(ARIA_LABEL, "Close inventory");
  element.append(title, summary, closeButton);
  return element;
};

interface NavigationButtonInput {
  label: string;
  dataKey: "inventoryTab" | "inventoryFolder";
  id: string;
  action: () => void;
}

const navigationButton = ({ label, dataKey, id, action }: NavigationButtonInput): HTMLButtonElement => {
  const button = createHudButton(label, action);
  button.dataset[dataKey] = id;
  return button;
};

const navigation = (
  callbacks: InventoryShellCallbacks,
): { tabs: HTMLDivElement; folders: HTMLElement } => {
  const tabs = document.createElement("div");
  tabs.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
  tabs.append(...TABS.map((tab) =>
    navigationButton({ label: tab, dataKey: "inventoryTab", id: tab, action: () => callbacks.selectTab(tab) })));
  const folders = document.createElement("nav");
  folders.style.cssText = "display:grid;align-content:start;gap:5px";
  folders.append(...FOLDERS.map((folder) => {
    const button = navigationButton({
      label: folder.label,
      dataKey: "inventoryFolder",
      id: folder.id,
      action: () => callbacks.selectFolder(folder.id),
    });
    button.style.textAlign = "left";
    return button;
  }));
  return { tabs, folders };
};

const filterInput = (search: () => void): HTMLInputElement => {
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Filter items";
  input.setAttribute(ARIA_LABEL, "Filter inventory items");
  input.style.cssText =
    "min-width:140px;padding:6px 8px;border:1px solid #555a75;" +
    "background:#11121d;color:#f2f0eb;font:11px monospace";
  input.addEventListener("input", search);
  return input;
};

export const createInventoryShell = (
  callbacks: InventoryShellCallbacks,
): InventoryShell => {
  const { element, shell } = workspace();
  const { tabs, folders } = navigation(callbacks);
  const search = filterInput(callbacks.search);
  const summary = document.createElement("span");
  summary.style.color = "#aaaec8";
  const { toolbar, body, list } = createInventoryContent(tabs, folders, search);
  shell.append(header(summary, callbacks.close), toolbar, body);
  return {
    element, tabs, folders, search, list, summary,
  };
};
