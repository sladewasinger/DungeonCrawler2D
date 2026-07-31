import { buildAssetPath } from "../../boot/assetManifest.js";
import { petIdleFrame } from "../../boot/petAssetFrame.js";
import type { AdminCatalogVisual } from "./adminCatalogDefinitions.js";

const ATLAS_SCALE = 2;
const ATLAS_WIDTH = 512;
const ATLAS_HEIGHT = 594;

export interface AdminCatalogCardContent {
  readonly id: string;
  readonly name: string;
  readonly stats: readonly string[];
  readonly image: AdminCatalogVisual | null;
}

export function adminCatalogCardContent(entry: AdminCatalogCardContent): readonly HTMLElement[] {
  return [catalogPreview(entry), catalogCopy(entry)];
}

function catalogPreview(entry: AdminCatalogCardContent): HTMLElement {
  const preview = document.createElement("span");
  preview.dataset.adminCatalogPreview = "";
  preview.style.cssText = "display:grid;place-items:center;width:56px;min-height:56px;background:#111722;border:1px solid #394152;border-radius:4px";
  preview.append(entry.image ? catalogSprite(entry.image) : fallbackSprite(entry.id));
  return preview;
}

function catalogCopy(entry: AdminCatalogCardContent): HTMLElement {
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

function catalogSprite(image: AdminCatalogVisual): HTMLElement {
  return "source" in image ? petSprite(image) : atlasSprite(image);
}

function atlasSprite(image: Exclude<AdminCatalogVisual, { readonly source: "pet" }>): HTMLElement {
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

function petSprite(image: Extract<AdminCatalogVisual, { readonly source: "pet" }>): HTMLElement {
  const sprite = document.createElement("span");
  sprite.style.cssText = [
    "display:block",
    "position:relative",
    `width:${image.width * ATLAS_SCALE}px`,
    `height:${image.height * ATLAS_SCALE}px`,
    "overflow:hidden",
    "image-rendering:pixelated",
  ].join(";");
  const sheet = document.createElement("img");
  sheet.alt = "";
  sheet.style.cssText = "position:absolute;visibility:hidden;max-width:none;image-rendering:pixelated";
  sheet.addEventListener("load", () => positionPetSheet(sheet, image));
  sheet.src = image.path;
  sprite.append(sheet);
  return sprite;
}

function positionPetSheet(
  sheet: HTMLImageElement,
  image: Extract<AdminCatalogVisual, { readonly source: "pet" }>,
): void {
  const frame = petIdleFrame(image.defId, sheet.naturalWidth);
  if (!frame) return;
  sheet.style.width = `${sheet.naturalWidth * ATLAS_SCALE}px`;
  sheet.style.height = `${sheet.naturalHeight * ATLAS_SCALE}px`;
  sheet.style.left = `${-frame.x * ATLAS_SCALE}px`;
  sheet.style.top = `${-frame.y * ATLAS_SCALE}px`;
  sheet.style.visibility = "visible";
}

function fallbackSprite(id: string): HTMLElement {
  const fallback = document.createElement("span");
  fallback.textContent = id.slice(0, 1).toUpperCase();
  fallback.style.cssText = "display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#4b556a;color:#fff;font-weight:700";
  return fallback;
}
