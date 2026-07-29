import type Phaser from "phaser";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import {
  createAnimatedAreaRig,
  type AmbientAreaKind,
  type AnimatedAreaRig,
  type AnimatedAreaRigFactory,
} from "./areaAnimatedRig.js";
import type { AreaTileView } from "../areaEffectPool.js";
import {
  type AreaVisualBudget,
  defaultAreaVisualBudget,
} from "../presentation/areaVisualBudget.js";
const ANIMATED_KINDS = new Set<AreaTileView["sprite"]>([
  "poison",
  "steam",
]);

export class AreaAnimatedPool {
  private readonly active = new Map<string, AnimatedAreaRig>();
  private readonly spare = new Map<AmbientAreaKind, AnimatedAreaRig[]>();
  private readonly seen = new Set<string>();
  private readonly lights: LightSource[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly budget = defaultAreaVisualBudget(),
    private readonly factory: AnimatedAreaRigFactory = (kind) =>
      createAnimatedAreaRig(scene, kind, budget.emissionFrequencyScale),
  ) {}

  sync(tiles: readonly AreaTileView[]): LightSource[] {
    this.seen.clear();
    this.lights.length = 0;
    const counts = { poison: 0, steam: 0 };
    for (const tile of tiles) this.syncTile(tile, counts);
    this.releaseUnseen();
    return this.lights;
  }

  private syncTile(
    tile: AreaTileView,
    counts: Record<AmbientAreaKind, number>,
  ): void {
    const kind = animatedKind(tile);
    if (!kind || counts[kind] >= maximumFor(this.budget, kind)) return;
    counts[kind]++;
    this.seen.add(tile.id);
    const rig = this.rigFor(tile.id, kind);
    rig.activate(tile);
    this.lights.push(rig.light);
  }

  private rigFor(id: string, kind: AmbientAreaKind): AnimatedAreaRig {
    const existing = this.active.get(id);
    if (existing?.kind === kind) return existing;
    if (existing) this.release(id, existing);
    const rig = this.spare.get(kind)?.pop() ?? this.factory(kind);
    this.active.set(id, rig);
    return rig;
  }

  private releaseUnseen(): void {
    for (const [id, rig] of this.active) {
      if (!this.seen.has(id)) this.release(id, rig);
    }
  }

  private release(id: string, rig: AnimatedAreaRig): void {
    this.active.delete(id);
    rig.deactivate();
    const spare = this.spare.get(rig.kind) ?? [];
    if (spare.length >= this.budget.maximumSpareRigsPerKind) rig.destroy();
    else {
      spare.push(rig);
      this.spare.set(rig.kind, spare);
    }
  }

  dispose(): void {
    for (const rig of this.active.values()) rig.destroy();
    for (const spare of this.spare.values()) {
      for (const rig of spare) rig.destroy();
    }
    this.active.clear();
    this.spare.clear();
  }
}

function animatedKind(tile: AreaTileView): AmbientAreaKind | null {
  return ANIMATED_KINDS.has(tile.sprite)
    ? tile.sprite as AmbientAreaKind
    : null;
}

function maximumFor(
  budget: AreaVisualBudget,
  kind: AmbientAreaKind,
): number {
  if (kind === "poison") return budget.maximumPoisonRigs;
  return budget.maximumSteamRigs;
}
