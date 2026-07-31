import { buildAssetPath } from "../../boot/assetManifest.js";
import type { AdminSpawnKind } from "../adminPageSupport.js";
import {
  adminCatalogEntries,
  type AdminCatalogEntry,
  type AdminCatalogImage,
} from "./adminCatalogDefinitions.js";

const ATLAS_SCALE = 2;
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 594;

export interface AdminSpawnCatalog {
  readonly root: HTMLElement;
  render(input: AdminSpawnCatalogRenderInput): void;
}

export interface AdminSpawnCatalogRenderInput {
  readonly kind: AdminSpawnKind;
  readonly selectedId: string;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}

export function createAdminSpawnCatalog(): AdminSpawnCatalog {
  const root = document.createElement("div");
  root.dataset.adminCatalog = "";
  root.style.cssText = "display:grid;gap:8px;width:100%;max-height:286px;overflow:auto;padding:2px";
  return { root, render: (input) => renderCatalog(root, input) };
}

function renderCatalog(root: HTMLElement, input: AdminSpawnCatalogRenderInput): void {
  const entries = adminCatalogEntries(input.kind);
  root.replaceChildren(...entries.map((entry) => catalogCard(entry, input)));
  root.style.gridTemplateColumns = "repeat(auto-fill,minmax(178px,1fr))";
  root.style.alignContent = "start";
}

function catalogCard(
  entry: AdminCatalogEntry,
  input: AdminSpawnCatalogRenderInput,
): HTMLButtonElement {
  const card = document.createElement("button");
  card.type = "button";
  card.disabled = input.disabled;
  card.dataset.adminCatalogCard = "";
  card.dataset.definitionId = entry.id;
  card.dataset.selected = String(entry.id === input.selectedId);
  card.setAttribute("aria-pressed", String(entry.id === input.selectedId));
  card.title = `Select ${entry.name}`;
  card.style.cssText = cardStyle(entry.id === input.selectedId);
  card.append(catalogPreview(entry), catalogCopy(entry));
  card.addEventListener("click", () => input.onSelect(entry.id));
  return card;
}

function catalogPreview(entry: AdminCatalogEntry): HTMLElement {
  const preview = document.createElement("span");
  preview.dataset.adminCatalogPreview = "";
  preview.style.cssText = "display:grid;place-items:center;width:56px;min-height:56px;background:#111722;border:1px solid #394152;border-radius:4px";
  preview.append(entry.image ? atlasSprite(entry.image) : fallbackSprite(entry.id));
  return preview;
}

function catalogCopy(entry: AdminCatalogEntry): HTMLElement {
  const copy = document.createElement("span");
  copy.style.cssText = "display:grid;gap:4px;min-width:0;text-align:left";
  const name = document.createElement("strong");
  name.textContent = entry.name;
  name.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  const stats = document.createElement("span");
  stats.textContent = entry.stats.join(" · ") || "No combat stats";
  stats.style.cssText = "color:#b5c5de;font-size:12px;line-height:1.2";
  copy.append(name, stats);
  return copy;
}

function atlasSprite(image: AdminCatalogImage): HTMLElement {
  const sprite = document.createElement("span");
  const imagePath = buildAssetPath("assets/atlas.png");
  sprite.style.cssText = [
    "display:block",
    `width:${image.width * ATLAS_SCALE}px`,
    `height:${image.height * ATLAS_SCALE}px`,
    `background-image:url('${imagePath}')`,
    `background-size:${ATLAS_WIDTH * ATLAS_SCALE}px ${ATLAS_HEIGHT * ATLAS_SCALE}px`,
    `background-position:-${image.x * ATLAS_SCALE}px -${image.y * ATLAS_SCALE}px`,
    "background-repeat:no-repeat",
    "image-rendering:pixelated",
  ].join(";");
  return sprite;
}

function fallbackSprite(id: string): HTMLElement {
  const fallback = document.createElement("span");
  fallback.textContent = id.slice(0, 1).toUpperCase();
  fallback.style.cssText = "display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#4b556a;color:#fff;font-weight:700";
  return fallback;
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
