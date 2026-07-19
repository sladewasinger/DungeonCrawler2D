// World (continuous tile units) -> screen pixel conversion shared by every entity visual.
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";

export function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  return { x: worldX * SCREEN_TILE_PX, y: worldY * SCREEN_TILE_PX };
}
