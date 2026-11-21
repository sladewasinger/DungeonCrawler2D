import { TERRAIN, TILE } from "@dc2d/engine";
import type { EditorTerrainWorld } from "./EditorTerrainWorld.js";

export interface EditorHeightmapSurface {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  setWorld(world: EditorTerrainWorld): void;
  render(): void;
  dispose(): void;
}

export function createEditorHeightmapSurface(): EditorHeightmapSurface {
  const root = document.createElement("section");
  root.dataset.editorHeightmapPanel = "";
  const heading = document.createElement("strong");
  heading.textContent = "Heightmap editor";
  const help = document.createElement("p");
  help.textContent = "Left click raises the current tile; right click lowers it. Use the scene toolbar for fixtures.";
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  canvas.dataset.editorHeightmap = "";
  canvas.setAttribute("aria-label", "Tile-by-tile finite floor heightmap editor");
  root.append(heading, help, canvas);
  let world: EditorTerrainWorld | undefined;
  const onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (!world) return;
    const point = pointAt(canvas, world, event);
    if (!point || world.terrainAt(point.x, point.y) === TERRAIN.Void) return;
    world.adjustHeight(point.x, point.y, event.button === 2 ? -1 : 1);
    surface.render();
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  const surface: EditorHeightmapSurface = {
    root, canvas,
    setWorld: (next) => { world = next; surface.render(); },
    render: () => drawHeightmap(canvas, world),
    dispose: () => canvas.removeEventListener("pointerdown", onPointerDown),
  };
  return surface;
}

function pointAt(canvas: HTMLCanvasElement, world: EditorTerrainWorld, event: PointerEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const x = world.floorBounds.minX + Math.floor(((event.clientX - rect.left) / rect.width) * world.floorBounds.width);
  const y = world.floorBounds.minY + Math.floor(((event.clientY - rect.top) / rect.height) * world.floorBounds.height);
  return world.contains({ x, y }) ? { x, y } : null;
}

function drawHeightmap(canvas: HTMLCanvasElement, world: EditorTerrainWorld | undefined): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!world) {
    context.fillStyle = "#171922";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const bounds = world.floorBounds;
  const cellWidth = canvas.width / bounds.width;
  const cellHeight = canvas.height / bounds.height;
  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      context.fillStyle = cellColor(world, x, y);
      context.fillRect((x - bounds.minX) * cellWidth, (y - bounds.minY) * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
    }
  }
}

function cellColor(world: EditorTerrainWorld, x: number, y: number): string {
  if (world.terrainAt(x, y) === TERRAIN.Void) return "#080910";
  const tile = world.tileAt(x, y);
  if (tile === TILE.Bedrock) return "#8d5961";
  if (tile === TILE.Stairs) return "#f2c14e";
  if (tile === TILE.DoorExit) return "#db8a3b";
  if (world.fixtureAt(x, y)) return "#62c6b2";
  const shade = Math.min(235, 80 + Math.round(world.heightAt(x, y) * 35));
  return `rgb(${shade},${shade},${Math.min(255, shade + 10)})`;
}
