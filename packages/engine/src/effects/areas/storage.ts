import type { ContentRegistry } from "../types.js";
import { areaTileState } from "./layers.js";
import type {
  AreaCell,
  AreaLayer,
  AreaTileState,
} from "./types.js";

export class AreaCellStorage {
  readonly cells = new Map<string, AreaCell>();
  private dirty = new Map<string, AreaTileState>();
  private diagnostics: string[] = [];

  constructor(private readonly content: ContentRegistry) {}

  cellAt(x: number, y: number): AreaCell | undefined {
    return this.cells.get(areaKey(x, y));
  }

  commit(request: AreaCellCommit): void {
    const { x, y, layers } = request;
    const key = areaKey(x, y);
    if (layers.length === 0) this.cells.delete(key);
    else this.cells.set(key, { layers });
    if (request.publish) this.dirty.set(key, this.snapshotAt(x, y));
  }

  remove(x: number, y: number): void {
    const key = areaKey(x, y);
    if (!this.cells.delete(key)) return;
    this.dirty.set(key, { x, y, defId: null });
  }

  snapshotAt(x: number, y: number): AreaTileState {
    return areaTileState({
      content: this.content,
      x,
      y,
      cell: this.cellAt(x, y),
    });
  }

  allTiles(): AreaTileState[] {
    const out: AreaTileState[] = [];
    for (const [key, cell] of this.cells) {
      const [x, y] = parseAreaKey(key);
      out.push(areaTileState({ content: this.content, x, y, cell }));
    }
    return out;
  }

  drainDirty(): AreaTileState[] {
    const out = [...this.dirty.values()];
    this.dirty.clear();
    return out;
  }

  diagnose(message: string): void {
    this.diagnostics.push(message);
  }

  drainDiagnostics(): string[] {
    const out = this.diagnostics;
    this.diagnostics = [];
    return out;
  }
}

export interface AreaCellCommit {
  readonly x: number;
  readonly y: number;
  readonly layers: AreaLayer[];
  readonly publish: boolean;
}

export function parseAreaKey(key: string): [number, number] {
  return key.split(",").map(Number) as [number, number];
}

function areaKey(x: number, y: number): string {
  return `${x},${y}`;
}
