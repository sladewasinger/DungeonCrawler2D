// Cursor inspector text: terrain read (unchanged) plus the bench read (Epic 7.11) — a
// painted area tile and/or enemy/item spawn at the hovered cell.
import { TILE } from "@dc2d/engine";
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

export function inspectorText(store: EditorStore, x: number, y: number): string {
  const cell = store.world.cellAt(x, y);
  const face = ownFaceRowAt(store.world, x, y);
  const tileName = cell.tile === TILE.Wall ? "rock" : cell.tile === TILE.DoorSafeRoom ? "door" : "floor";
  const faceText = face
    ? ` | face row ${face.rowFromTop}/${face.distanceToGround + face.rowFromTop - 1} of z${face.surfaceHeight}`
    : store.world.isWalkable(x, y)
      ? " | walkable"
      : " | blocked";
  return `(${x},${y}) ${tileName} z=${cell.height}${faceText}${benchText(store, x, y)}`;
}
