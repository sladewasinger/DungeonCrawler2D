import type { TerrainType } from "@dc2d/engine";

export interface RescueWorld {
  isWalkable(x: number, y: number): boolean;
  terrainAt(x: number, y: number): TerrainType;
  heightAt(x: number, y: number): number;
  groundAt(x: number, y: number): number;
}
