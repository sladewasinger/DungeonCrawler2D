import { controlFieldset } from "../adminPagePrimitives.js";
import type { AdminSpawnKind } from "../adminPageSupport.js";
import {
  adminCatalogEntries,
  type AdminCatalogEntry,
} from "./adminCatalogDefinitions.js";
import { adminCatalogCardContent } from "./adminCatalogCardContent.js";
import { adminSpawnTypeTabs } from "./adminSpawnTypeTabs.js";

export interface AdminSpawnCatalog {
  readonly root: HTMLElement;
  render(input: AdminSpawnCatalogRenderInput): void;
}

export interface AdminSpawnCatalogRenderInput {
  readonly kind: AdminSpawnKind;
  readonly selectedId: string;
  readonly availableIds: readonly string[];
  readonly disabledIds?: readonly string[];
  readonly notice?: string;
  readonly disabled: boolean;
  readonly onSelectKind: (kind: AdminSpawnKind) => void;
  readonly onSelect: (id: string) => void;
}

export function createAdminSpawnCatalog(): AdminSpawnCatalog {
  const root = controlFieldset("Entity palette");
  root.dataset.adminCatalog = "";
  let renderKey = "";
  return {
    root,
    render: (input) => {
      const nextKey = catalogRenderKey(input);
      if (nextKey === renderKey) return;
      renderKey = nextKey;
      renderCatalog(root, input);
    },
  };
}

function renderCatalog(root: HTMLElement, input: AdminSpawnCatalogRenderInput): void {
  const panel = catalogPanel(input);
  root.replaceChildren(
    adminSpawnTypeTabs(input.kind, input.onSelectKind),
    ...(input.notice ? [catalogNotice(input.notice)] : []),
    panel,
  );
}

function catalogPanel(input: AdminSpawnCatalogRenderInput): HTMLElement {
  const panel = document.createElement("div");
  panel.id = "admin-spawn-catalog-panel";
  panel.dataset.adminCatalogGrid = "";
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `admin-spawn-${input.kind}-tab`);
  panel.append(...adminCatalogEntries(input.kind).map((entry) => catalogCard(entry, input)));
  return panel;
}

function catalogCard(
  entry: AdminCatalogEntry,
  input: AdminSpawnCatalogRenderInput,
): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.disabled = input.disabled || isUnavailableCatalogEntry(entry.id, input);
  card.dataset.adminCatalogCard = "";
  card.dataset.definitionId = entry.id;
  card.dataset.selected = String(entry.id === input.selectedId);
  card.setAttribute("aria-pressed", String(entry.id === input.selectedId));
  card.title = cardTitle({
    name: entry.name,
    selected: entry.id === input.selectedId,
    unavailable: isUnavailableCatalogEntry(entry.id, input),
    notice: input.notice,
  });
  card.style.cssText = cardStyle(entry.id === input.selectedId);
  card.append(...adminCatalogCardContent(entry), selectedCardMarker(entry.id === input.selectedId));
  card.addEventListener("click", () => input.onSelect(entry.id));
  return card;
}

function catalogNotice(message: string): HTMLElement {
  const note = document.createElement("p");
  note.dataset.adminCatalogNotice = "";
  note.textContent = message;
  return note;
}

function cardTitle(input: CatalogCardTitleInput): string {
  if (input.unavailable) return input.notice ?? `${input.name} is not available.`;
  return input.selected
    ? `${input.name} selected. Click a walkable map tile to place it.`
    : `Select ${input.name}`;
}

interface CatalogCardTitleInput {
  readonly name: string;
  readonly selected: boolean;
  readonly unavailable: boolean;
  readonly notice: string | undefined;
}

function selectedCardMarker(selected: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.dataset.adminCatalogSelectedMarker = "";
  marker.hidden = !selected;
  marker.textContent = "Selected";
  return marker;
}

function catalogRenderKey(input: AdminSpawnCatalogRenderInput): string {
  return [
    input.kind,
    input.selectedId,
    input.disabled ? "disabled" : "enabled",
    input.notice ?? "",
    ...input.availableIds,
    ...(input.disabledIds ?? []),
  ].join(":");
}

function cardStyle(selected: boolean): string {
  const border = selected ? "#f0c36a" : "#394152";
  const background = selected ? "#293242" : "#202736";
  return [
    "display:grid",
    "grid-template-columns:56px minmax(0,1fr)",
    "gap:10px",
    "align-items:center",
    "padding:8px",
    `border:1px solid ${border}`,
    "border-radius:6px",
    `background:${background}`,
    "color:#e9edf5",
    "cursor:pointer",
  ].join(";");
}

function isUnavailableCatalogEntry(
  definitionId: string,
  input: AdminSpawnCatalogRenderInput,
): boolean {
  return !input.availableIds.includes(definitionId) || input.disabledIds?.includes(definitionId) === true;
}
