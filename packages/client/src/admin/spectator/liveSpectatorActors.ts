import type { AdminMap, AdminMapEntity } from "@dc2d/engine";
import { adminCatalogImage, type AdminCatalogImage } from "../catalog/adminCatalogDefinitions.js";
import {
  liveSpectatorPoint,
  liveSpectatorPointIsVisible,
  type LiveSpectatorPoint,
  type LiveSpectatorView,
} from "./liveSpectatorView.js";
import { drawLiveSpectatorPet } from "./pets/liveSpectatorPetRenderer.js";

export interface LiveSpectatorActorInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap;
  readonly targetId: string | null;
  readonly atlas: HTMLImageElement;
  readonly pets: Readonly<Record<string, HTMLImageElement>>;
  readonly view: LiveSpectatorView;
}

interface EntityScreenInput extends Omit<LiveSpectatorActorInput, "map"> {
  readonly entity: AdminMapEntity;
  readonly point: LiveSpectatorPoint;
}

export function drawLiveSpectatorActors(input: LiveSpectatorActorInput): void {
  const entities = [...input.map.entities].sort((left, right) => entityDepth(left, input.view) - entityDepth(right, input.view));
  for (const entity of entities) drawActor({ ...input, entity });
}

function drawActor(input: LiveSpectatorActorInput & { readonly entity: AdminMapEntity }): void {
  const point = liveSpectatorPoint(input.view, input.entity, input.entity.z);
  if (!liveSpectatorPointIsVisible(point, input.context.canvas, input.view.tileSize * 2)) return;
  const screenInput = { ...input, point };
  drawShadow(screenInput);
  drawBody(screenInput);
  drawLabel(screenInput);
  if (input.entity.id === input.targetId) drawTargetRing(input.context, point, input.view.tileSize);
}

function drawShadow(input: EntityScreenInput): void {
  const radius = input.entity.kind === "enemy" ? input.view.tileSize * 0.23 : input.view.tileSize * 0.18;
  input.context.fillStyle = "rgb(0 0 0 / 40%)";
  input.context.beginPath();
  input.context.ellipse(input.point.x, input.point.y - 2, radius, radius * 0.42, 0, 0, Math.PI * 2);
  input.context.fill();
}

function drawBody(input: EntityScreenInput): void {
  const petImage = input.entity.defId ? input.pets[input.entity.defId] : undefined;
  if (input.entity.kind === "pet" && drawLiveSpectatorPet({
    context: input.context,
    entity: input.entity,
    image: petImage,
    point: input.point,
    tileSize: input.view.tileSize,
  })) return;
  const image = spriteImage(input.entity);
  if (image && atlasReady(input.atlas)) return drawAtlasSprite({ ...input, image });
  drawFallbackEntity(input);
}

function drawAtlasSprite(input: EntityScreenInput & { readonly image: AdminCatalogImage }): void {
  const scale = entityScale(input.entity, input.view.tileSize);
  const width = input.image.width * scale;
  const height = input.image.height * scale;
  input.context.imageSmoothingEnabled = false;
  input.context.drawImage(input.atlas, input.image.x, input.image.y, input.image.width, input.image.height,
    input.point.x - width / 2, input.point.y - height, width, height);
}

function drawFallbackEntity(input: EntityScreenInput): void {
  const radius = input.view.tileSize * (input.entity.kind === "enemy" ? 0.25 : 0.18);
  input.context.fillStyle = fallbackColor(input.entity.kind);
  input.context.fillRect(input.point.x - radius, input.point.y - radius * 2, radius * 2, radius * 2);
}

function drawLabel(input: EntityScreenInput): void {
  const label = entityLabel(input.entity, input.targetId);
  if (!label) return;
  const y = input.point.y - input.view.tileSize * 1.5;
  input.context.textAlign = "center";
  input.context.font = input.entity.id === input.targetId ? "bold 13px system-ui" : "12px system-ui";
  input.context.lineWidth = 3;
  input.context.strokeStyle = "#11151c";
  input.context.strokeText(label, input.point.x, y);
  input.context.fillStyle = input.entity.id === input.targetId ? "#f7e7a6" : "#ecf1fb";
  input.context.fillText(label, input.point.x, y);
  input.context.textAlign = "start";
}

function drawTargetRing(context: CanvasRenderingContext2D, point: LiveSpectatorPoint, tileSize: number): void {
  context.strokeStyle = "#f0c36a";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(point.x, point.y - 2, tileSize * 0.28, tileSize * 0.12, 0, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 1;
}

function spriteImage(entity: AdminMapEntity): AdminCatalogImage | null {
  if (entity.kind === "player") return playerImage(entity.id);
  if (entity.kind === "torch") return atlasCatalogImage("item", "torch");
  if (!entity.defId || (entity.kind !== "enemy" && entity.kind !== "item" && entity.kind !== "weapon")) return null;
  return atlasCatalogImage(entity.kind, entity.defId);
}

function atlasCatalogImage(
  kind: "enemy" | "item" | "weapon",
  definitionId: string,
): AdminCatalogImage | null {
  const image = adminCatalogImage(kind, definitionId);
  return image && !("source" in image) ? image : null;
}

function playerImage(id: string): AdminCatalogImage {
  return PLAYER_IMAGES[hashId(id) % PLAYER_IMAGES.length]!;
}

function hashId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function entityDepth(entity: AdminMapEntity, view: LiveSpectatorView): number {
  return liveSpectatorPoint(view, entity, entity.z).y;
}

function entityScale(entity: AdminMapEntity, tileSize: number): number {
  const base = tileSize / 16;
  if (entity.kind === "enemy") return base * 1.15;
  if (entity.kind === "pet") return base;
  if (entity.kind === "weapon" || entity.kind === "item") return base * 0.7;
  return base;
}

function entityLabel(entity: AdminMapEntity, targetId: string | null): string | null {
  if (entity.id === targetId) return entity.name ?? "Player";
  if (entity.kind === "player" || entity.kind === "enemy" || entity.kind === "pet") {
    return entity.name ?? entity.defId ?? entity.kind;
  }
  return null;
}

function fallbackColor(kind: AdminMapEntity["kind"]): string {
  if (kind === "player") return "#f4d35e";
  if (kind === "enemy") return "#ef6b73";
  if (kind === "pet") return "#72e6ad";
  if (kind === "weapon") return "#72d6e5";
  return kind === "item" ? "#c3a5f5" : "#f39c5a";
}

function atlasReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

const PLAYER_IMAGES: readonly AdminCatalogImage[] = [
  { x: 128, y: 4, width: 16, height: 28 },
  { x: 128, y: 68, width: 16, height: 28 },
  { x: 128, y: 132, width: 16, height: 28 },
  { x: 128, y: 196, width: 16, height: 28 },
];
