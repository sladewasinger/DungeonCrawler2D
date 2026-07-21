// Pit faces stay attached to the highest reachable rim while the terrain rises northward.
import { WALL_FACE_MIN_DROP } from "@dc2d/engine";
import type { TerrainRead } from "./faces.js";
import { faceSplit, MAX_FACE_ROWS } from "./ownFace.js";

export interface PitFaceRow {
  readonly rowFromTop: number;
  readonly totalRows: number;
  readonly surfaceHeight: number;
  readonly truncated: boolean;
}

export interface PitStepFaceRow extends PitFaceRow {
  readonly screenY: number;
  readonly isStep: true;
}

/** Rows owned by a below-base floor that drops further south. They begin below that
 * floor's shifted cap, rather than occupying the next pit floor's screen row. */
export function pitStepFaceRowsAt(world: TerrainRead, wx: number, wy: number): readonly PitStepFaceRow[] {
  const height = world.heightAt(wx, wy);
  const southHeight = world.heightAt(wx, wy + 1);
  if (height >= 0 || southHeight >= 0 || height - southHeight < WALL_FACE_MIN_DROP) return [];

  const rawRows = Math.round(height - southHeight);
  const totalRows = Math.min(rawRows, MAX_FACE_ROWS);
  return Array.from({ length: totalRows }, (_, index) => {
    const rowFromTop = index + 1;
    return {
      rowFromTop,
      totalRows,
      surfaceHeight: height,
      screenY: wy - height + rowFromTop,
      isStep: true,
      truncated: rowFromTop === MAX_FACE_ROWS && rawRows > MAX_FACE_ROWS,
    };
  });
}

export function pitFaceRowAt(world: TerrainRead, wx: number, wy: number): PitFaceRow | null {
  const floorHeight = world.heightAt(wx, wy);
  if (floorHeight >= 0) return null;

  const immediateNorthHeight = world.heightAt(wx, wy - 1);
  if (immediateNorthHeight < 0 && immediateNorthHeight - floorHeight >= WALL_FACE_MIN_DROP) return null;

  let highestNorthHeight = Number.NEGATIVE_INFINITY;
  let highestNorthDistance = 0;
  let previousNorthHeight = floorHeight;

  for (let distance = 1; distance <= MAX_FACE_ROWS; distance += 1) {
    const northHeight = world.heightAt(wx, wy - distance);
    if (northHeight < previousNorthHeight) break;
    previousNorthHeight = northHeight;

    // Retain the closest cell at a given height, but replace it when a stepped pit reaches a higher rim.
    if (northHeight - floorHeight >= WALL_FACE_MIN_DROP && northHeight > highestNorthHeight) {
      highestNorthHeight = northHeight;
      highestNorthDistance = distance;
    }
  }

  if (highestNorthDistance === 0) return null;

  const { rawRows, totalRows, rowsOnRaised } = faceSplit(highestNorthHeight, floorHeight);
  const rowFromTop = rowsOnRaised + highestNorthDistance;
  if (rowFromTop > totalRows) return null;

  return {
    rowFromTop,
    totalRows,
    surfaceHeight: highestNorthHeight,
    truncated: rowFromTop === MAX_FACE_ROWS && rawRows > MAX_FACE_ROWS
  };
}
