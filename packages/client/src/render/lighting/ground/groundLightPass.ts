import type { World } from "@dc2d/engine";
import { getViewOrientation } from "../../view/transform/viewState.js";
import type { LightSource } from "../core/lightSource.js";
import {
  playerGroundLightCells,
  shouldUpdatePlayerGroundLight,
  type PlayerGroundLightUpdate,
} from "./playerGroundLight.js";
import type { GroundLightRevealCell } from "./groundLightTypes.js";
import {
  broadLightRevealStyle,
} from "./groundLightSourceStyle.js";
import {
  exactSourceAnchors,
  sameExactSourceAnchors,
} from "./groundLightExactSources.js";

export interface GroundLightPassFrame {
  readonly enabled: boolean;
  readonly nowMs: number;
  readonly personal: Readonly<LightSource>;
  readonly worldLights: readonly LightSource[];
  readonly maximumCells: number;
}

/**
 * Builds a bounded, LOS-aware set of soft-mask stamps for the player and visible
 * wall/placed torches. Darkness owns the compositing so entities are never painted.
 */
export class GroundLightPass {
  private previousUpdate: PlayerGroundLightUpdate | null = null;
  private readonly broadCells: GroundLightRevealCell[] = [];
  private readonly sourceAnchors: GroundLightRevealCell[] = [];
  private readonly maskCells: GroundLightRevealCell[] = [];
  private readonly cellIndexes = new Map<string, number>();
  private enabled = true;

  constructor(private readonly world: World) {}

  update(frame: GroundLightPassFrame): boolean {
    const enabledChanged = this.syncEnabled(frame.enabled);
    if (!this.enabled) return enabledChanged;
    const anchorsChanged = this.refreshSourceAnchors(frame);
    const next = this.nextUpdate(frame);
    const broadChanged = shouldUpdatePlayerGroundLight(this.previousUpdate, next);
    if (broadChanged) this.refreshBroadCells(frame, next);
    if (anchorsChanged || broadChanged) this.rebuildMaskCells();
    return enabledChanged || anchorsChanged || broadChanged;
  }

  cellsForMask(): readonly GroundLightRevealCell[] { return this.maskCells; }

  invalidate(): void {
    this.previousUpdate = null;
  }

  private syncEnabled(enabled: boolean): boolean {
    if (this.enabled === enabled) return false;
    this.enabled = enabled;
    this.previousUpdate = null;
    if (!enabled) this.clearCells();
    return true;
  }

  private nextUpdate(frame: GroundLightPassFrame): PlayerGroundLightUpdate {
    return {
      tileX: Math.floor(frame.personal.x),
      tileY: Math.floor(frame.personal.y),
      orientation: getViewOrientation(),
      atMs: frame.nowMs,
    };
  }

  private refreshBroadCells(
    frame: GroundLightPassFrame,
    next: PlayerGroundLightUpdate,
  ): void {
    this.broadCells.length = 0;
    this.cellIndexes.clear();
    this.appendBroadSource(frame.personal, frame.maximumCells);
    for (const light of frame.worldLights) {
      if (this.broadCells.length >= frame.maximumCells) break;
      this.appendBroadSource(light, frame.maximumCells);
    }
    this.previousUpdate = next;
  }

  private appendBroadSource(
    source: Readonly<LightSource>,
    maximumCells: number,
  ): void {
    const style = broadLightRevealStyle(source);
    const sourceCells = playerGroundLightCells(
      this.world,
      { x: source.x, y: source.y, radiusTiles: style.radiusTiles },
    );
    for (const cell of sourceCells) {
      this.mergeCell({ ...cell, ...style }, maximumCells);
      if (this.broadCells.length >= maximumCells) return;
    }
  }

  private refreshSourceAnchors(frame: GroundLightPassFrame): boolean {
    const next = exactSourceAnchors(frame.personal, frame.worldLights);
    if (sameExactSourceAnchors(this.sourceAnchors, next)) return false;
    this.sourceAnchors.length = 0;
    this.sourceAnchors.push(...next);
    return true;
  }

  private rebuildMaskCells(): void {
    this.maskCells.length = 0;
    this.maskCells.push(...this.broadCells, ...this.sourceAnchors);
  }

  private clearCells(): void {
    this.broadCells.length = 0;
    this.sourceAnchors.length = 0;
    this.maskCells.length = 0;
    this.cellIndexes.clear();
  }

  private mergeCell(cell: GroundLightRevealCell, maximumCells: number): void {
    const key = `${cell.tileX},${cell.tileY}`;
    const existingIndex = this.cellIndexes.get(key);
    if (existingIndex !== undefined) {
      const existing = this.broadCells[existingIndex];
      if (existing && existing.brushAlpha * existing.strength < cell.brushAlpha * cell.strength) {
        this.broadCells[existingIndex] = cell;
      }
      return;
    }
    if (this.broadCells.length >= maximumCells) return;
    this.cellIndexes.set(key, this.broadCells.length);
    this.broadCells.push(cell);
  }
}
