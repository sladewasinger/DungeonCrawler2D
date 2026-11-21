import type { AdminSpawnKind } from "../portal/adminPageSupport.js";

export const ADMIN_SPAWN_TYPES: readonly AdminSpawnKind[] = ["enemy", "item", "weapon", "pet"];
export const ADMIN_SPAWN_TAB_COLUMNS = 4;

export function adminSpawnTypeTabs(
  selectedKind: AdminSpawnKind,
  onSelect: (kind: AdminSpawnKind) => void,
): HTMLElement {
  const tabs = document.createElement("div");
  tabs.dataset.adminCatalogTabs = "";
  tabs.dataset.adminCatalogTabCount = String(ADMIN_SPAWN_TAB_COLUMNS);
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Entity type");
  tabs.append(...ADMIN_SPAWN_TYPES.map((kind) => spawnTypeTab(kind, selectedKind, onSelect)));
  return tabs;
}

function spawnTypeTab(
  kind: AdminSpawnKind,
  selectedKind: AdminSpawnKind,
  onSelect: (kind: AdminSpawnKind) => void,
): HTMLButtonElement {
  const selected = kind === selectedKind;
  const tab = document.createElement("button");
  tab.type = "button";
  tab.id = `admin-spawn-${kind}-tab`;
  tab.dataset.adminCatalogKind = kind;
  tab.dataset.selected = String(selected);
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", String(selected));
  tab.setAttribute("aria-controls", "admin-spawn-catalog-panel");
  tab.textContent = spawnTypeLabel(kind);
  tab.addEventListener("click", () => onSelect(kind));
  return tab;
}

function spawnTypeLabel(kind: AdminSpawnKind): string {
  return `${kind.slice(0, 1).toUpperCase()}${kind.slice(1)}`;
}
