import { TILE } from "@dc2d/engine";
import type { EditorCell, EditorPoint, EditorTerrainWorld, EditorTool } from "./EditorTerrainWorld.js";

export function paintEditorCell(tool: Exclude<EditorTool, "height">, height: number): EditorCell {
  if (tool === "wall") return { tile: TILE.Bedrock, height: Math.max(2, height) };
  if (tool === "door") return { tile: TILE.DoorExit, height };
  if (tool === "stairs") return { tile: TILE.Stairs, height };
  if (tool === "safe" || tool === "spawn" || tool === "arena" || tool === "feature") {
    return { tile: TILE.Floor, height, fixture: tool };
  }
  return { tile: TILE.Floor, height };
}

export function placeEditorStair(
  world: EditorTerrainWorld,
  request: { readonly start: EditorPoint; readonly destination: EditorPoint },
): boolean {
  const { start, destination } = request;
  if (!areCardinalNeighbors(start, destination) || !world.isEditablePoint(start) ||
      !world.isEditablePoint(destination)) return false;
  const startHeight = world.heightAt(start.x, start.y);
  const destinationHeight = Math.max(startHeight + 1, world.heightAt(destination.x, destination.y));
  world.setEditedCell(start.x, start.y, { tile: TILE.Stairs, height: (startHeight + destinationHeight) / 2 });
  world.setEditedCell(destination.x, destination.y, { tile: TILE.Floor, height: destinationHeight });
  return true;
}

function areCardinalNeighbors(first: EditorPoint, second: EditorPoint): boolean {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1;
}
