// Cursor inspector text: terrain read (now against @dc2d/engine's StackTile fields —
// wall count, cap, stair direction, door) plus the bench read (Epic 7.11) — a painted
// area tile and/or enemy/item spawn at the hovered cell.
import { TILE } from "@dc2d/engine";
import { maskHex } from "../../../render/terrain/autotile.js";
import { ownFaceRowAt } from "../../../render/terrain/ownFace.js";
import type { EditorStore } from "../editorStore.js";

function benchText(store: EditorStore, x: number, y: number): string {
  const areaId = store.bench.areas.defAt(x, y);
  const key = `${x},${y}`;
  const enemy = store.bench.enemies.get(key);
  const item = store.bench.items.get(key);
  const parts: string[] = [];
  if (areaId) parts.push(areaId);
  if (enemy) parts.push(`${enemy.def.name} (${Math.round(enemy.entity.hp)}/${enemy.entity.maxHp}hp)`);
  if (item) parts.push(item.defId);
  return parts.length ? ` | ${parts.join(", ")}` : "";
}

/** "wall x2", "floor (medieval-sewer:1)", "stairs dir=0", "door" — the paint-over
 * vocabulary's own state, distinct from the compiled tile/height ownFaceRowAt reads. */
function stackText(store: EditorStore, x: number, y: number): string {
  const stack = store.world.stackAt(x, y);
  if (stack.stair) return `stairs dir=${stack.stair.dir}`;
  if (stack.feature) return `${stack.feature} (wall x${stack.walls})`;
  if (stack.cap !== null) return stack.walls > 0 ? `floor cap (${stack.cap}) on wall x${stack.walls}` : "floor";
  return `wall x${stack.walls}`;
}

/** "mask=0x0F (8-bit 0xFF)" — the exact bitmask autotile.ts solved for this cell, so the
 * user can verify it by hand against the neighbors they see on screen. */
function autotileText(store: EditorStore, x: number, y: number): string {
  const mask = store.autotileMasks.get(x, y);
  if (!mask) return "";
  return ` | mask=${maskHex(mask.mask4)} (8-bit ${maskHex(mask.mask8)})`;
}

export function inspectorText(store: EditorStore, x: number, y: number): string {
  const cell = store.world.cellAt(x, y);
  const face = ownFaceRowAt(store.world, x, y);
  const faceText = face
    ? ` | face row ${face.rowFromTop}/${face.distanceToGround + face.rowFromTop - 1} of z${face.surfaceHeight}`
    : store.world.isWalkable(x, y)
      ? " | walkable"
      : " | blocked";
  const torchText = store.world.hasTorch(x, y) ? " | torch" : "";
  const tileName = cell.tile === TILE.Wall ? "Wall" : cell.tile === TILE.DoorSafeRoom ? "Door" : "Floor";
  return `(${x},${y}) ${tileName} z=${cell.height} | ${stackText(store, x, y)}${faceText}${torchText}${autotileText(store, x, y)}${benchText(store, x, y)}`;
}
