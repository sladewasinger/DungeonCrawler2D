// The read surface the terrain renderer needs from a world. Structural, so the
// live engine World and the editor's hand-painted EditableWorld both satisfy it —
// the renderer never cares which one it is drawing.
import type { TerrainType, TileType, ZoneType } from "@dc2d/engine";

export interface TerrainWorld {
  tileAt(wx: number, wy: number): TileType;
  /** Authoritative Floor/Void plane; optional only for small renderer test fakes. */
  terrainAt?: (wx: number, wy: number) => TerrainType;
  heightAt(wx: number, wy: number): number;
  zoneAt(wx: number, wy: number): ZoneType;
  isSanctuary(wx: number, wy: number): boolean;
  isWalkable(wx: number, wy: number): boolean;
  groundAt(x: number, y: number): number;
}
