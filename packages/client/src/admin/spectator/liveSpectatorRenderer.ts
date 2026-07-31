import type { AdminMap } from "@dc2d/engine";
import { drawLiveSpectatorActors } from "./liveSpectatorActors.js";
import { drawLiveSpectatorTerrain } from "./liveSpectatorTerrain.js";
import { createLiveSpectatorView } from "./liveSpectatorView.js";

export interface LiveSpectatorRenderInput {
  readonly context: CanvasRenderingContext2D;
  readonly map: AdminMap | null;
  readonly targetId: string | null;
  readonly atlas: HTMLImageElement;
  readonly terrain: HTMLImageElement;
  readonly pets: Readonly<Record<string, HTMLImageElement>>;
}

export function renderLiveSpectatorMap(input: LiveSpectatorRenderInput): void {
  clear(input.context);
  const map = input.map;
  if (!map) return;
  const view = createLiveSpectatorView({ map, targetId: input.targetId, canvas: input.context.canvas });
  drawLiveSpectatorTerrain({ context: input.context, map, terrain: input.terrain, view });
  drawLiveSpectatorActors({
    context: input.context,
    map,
    targetId: input.targetId,
    atlas: input.atlas,
    pets: input.pets,
    view,
  });
  drawFrame({ context: input.context, targetId: input.targetId, map });
}

function clear(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#05080d";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
}

function drawFrame(input: Pick<LiveSpectatorRenderInput, "context" | "targetId"> & { readonly map: AdminMap }): void {
  const { context, targetId, map } = input;
  const { width, height } = context.canvas;
  context.strokeStyle = "rgb(182 198 222 / 68%)";
  context.strokeRect(0.5, 0.5, width - 1, height - 1);
  context.fillStyle = "rgb(5 8 13 / 75%)";
  context.fillRect(8, 8, 154, 24);
  context.fillStyle = "#dce6f7";
  context.font = "bold 12px system-ui";
  context.fillText(targetId ? "LIVE SPECTATOR" : "SELECT A PLAYER", 14, 24);
  context.font = "11px system-ui";
  context.fillText(`${map.level} · floor ${map.floor}`, width - 104, 24);
}
