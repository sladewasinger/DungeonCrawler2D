// Authoritative compound tile-region effects with bounded, data-authored reactions.
import type { AreaDef, ContentRegistry } from "../types.js";
import type { WorldView } from "../../world/core/types.js";
import {
  areaCellContacts,
  areaCellHasTag,
  areaLayerAt,
} from "./cellQueries.js";
import { igniteAreaFuel } from "./fuelIgnition.js";
import { composeAreaPlacement } from "./placement.js";
import { commitAreaTransition } from "./reactions/commit.js";
import { spawnArea } from "./spawn.js";
import { AreaCellStorage, parseAreaKey } from "./storage.js";
import {
  AreaTickScratch,
  tickAreas,
  type AreaTickUpdate,
} from "./tick.js";
import type {
  AreaContact,
  AreaIgnition,
  AreaPlacement,
  AreaPlacementResult,
  AreaSpawn,
} from "./types.js";

export interface AreaWorld extends WorldView {
  isSanctuary(x: number, y: number): boolean;
}

export class AreaSystem {
  private readonly storage: AreaCellStorage;
  private readonly tickScratch = new AreaTickScratch();

  constructor(
    private readonly content: ContentRegistry,
    private readonly world: AreaWorld,
  ) {
    this.storage = new AreaCellStorage(content);
  }

  get size(): number { return this.storage.cells.size; }

  defAt(x: number, y: number): string | null {
    return this.storage.snapshotAt(x, y).defId;
  }

  defsAt(x: number, y: number): string[] {
    return this.storage.cellAt(x, y)?.layers.map((layer) => layer.defId) ?? [];
  }

  sourceIdAt(x: number, y: number): string | undefined {
    const defId = this.defAt(x, y);
    return defId ? this.sourceIdFor(x, y, defId) : undefined;
  }

  sourceIdFor(x: number, y: number, defId: string): string | undefined {
    return areaLayerAt(this.storage.cellAt(x, y), defId)?.sourceId;
  }

  hasTagAt(x: number, y: number, tag: string): boolean {
    return areaCellHasTag(this.content, this.storage.cellAt(x, y), tag);
  }

  contactsAt(x: number, y: number): AreaContact[] {
    return areaCellContacts(this.content, this.storage.cellAt(x, y));
  }

  igniteFuelAt(request: AreaIgnition): boolean {
    return igniteAreaFuel({
      content: this.content,
      cell: this.storage.cellAt(request.x, request.y),
      ignition: request,
      hasFire: this.hasTagAt(request.x, request.y, "fire"),
      place: (placement) => this.place(placement),
    });
  }

  spawn(spawn: AreaSpawn): void {
    spawnArea({ spawn, place: (placement) => this.place(placement) });
  }

  place(placement: AreaPlacement): AreaPlacementResult {
    const def = this.content.areas.get(placement.defId);
    if (!def) return { applied: false, reason: "unknown-area" };
    if (!this.canPlace(def, placement.x, placement.y)) {
      return { applied: false, reason: "blocked-tile" };
    }
    return this.placeLayer(placement, def);
  }

  remove(x: number, y: number): void {
    this.storage.remove(x, y);
  }

  tick(dt: number, rng: () => number): void {
    tickAreas({
      content: this.content,
      world: this.world,
      cells: this.storage.cells,
      place: (placement) => this.place(placement),
      update: (update) => this.updateCell(update),
      hasTagAt: (x, y, tag) => this.hasTagAt(x, y, tag),
      scratch: this.tickScratch,
    }, dt, rng);
  }

  drainDirty() { return this.storage.drainDirty(); }

  drainDiagnostics(): string[] {
    return this.storage.drainDiagnostics();
  }

  allTiles() { return this.storage.allTiles(); }

  private placeLayer(
    placement: AreaPlacement,
    def: AreaDef,
  ): AreaPlacementResult {
    const existing = this.storage.cellAt(placement.x, placement.y)?.layers ?? [];
    const composed = composeAreaPlacement({
      content: this.content,
      existing,
      placement,
      def,
    });
    if (!composed.ok) return { applied: false, reason: composed.reason };
    return commitAreaTransition({
      content: this.content,
      storage: this.storage,
      x: placement.x,
      y: placement.y,
      layers: composed.layers,
      publish: true,
    });
  }

  private updateCell(update: AreaTickUpdate): boolean {
    const [x, y] = parseAreaKey(update.areaKey);
    return commitAreaTransition({
      content: this.content,
      storage: this.storage,
      x,
      y,
      layers: update.layers,
      publish: update.publish,
    }).applied;
  }

  private canPlace(def: AreaDef, x: number, y: number): boolean {
    if (!this.world.isWalkable(x, y)) return false;
    return !def.tags.includes("hostile") || !this.world.isSanctuary(x, y);
  }
}
