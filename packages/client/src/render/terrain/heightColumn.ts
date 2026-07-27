import { isVoidCellAt, type TerrainRead } from "./faces.js";

export function freestandingHeightBodyRows(world: TerrainRead, wx: number, wy: number): readonly number[] {
  if (isVoidCellAt(world, wx, wy)) return [];
  const height = world.heightAt(wx, wy);
  if (height <= 1) return [];
  if (Math.abs(world.heightAt(wx, wy - 1) - height) < 0.01) return [];
  if (Math.abs(world.heightAt(wx, wy + 1) - height) < 0.01) return [];
  return Array.from({ length: Math.ceil(height) - 1 }, (_, index) => index + 1);
}
