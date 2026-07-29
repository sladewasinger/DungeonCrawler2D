import type Phaser from "phaser";
import type { AreaTileView } from "../areaEffectPool.js";
import {
  defaultAreaVisualBudget,
  type AreaVisualBudget,
} from "../presentation/areaVisualBudget.js";
import type { PuddleKind } from "../presentation/areaVisualStyle.js";
import { PoisonBubbleLayer } from "./poisonBubbleLayer.js";
import { PuddleLayer } from "./puddleLayer.js";

const PUDDLE_KINDS: readonly PuddleKind[] = ["wet", "oil", "poison"];

export class AreaPuddleLayers {
  private readonly layers: readonly PuddleLayer[];
  private readonly poisonBubbles: PoisonBubbleLayer;

  constructor(
    scene: Phaser.Scene,
    budget: AreaVisualBudget = defaultAreaVisualBudget(),
  ) {
    this.layers = PUDDLE_KINDS.map((kind) => new PuddleLayer(scene, kind));
    this.poisonBubbles = new PoisonBubbleLayer(scene, budget);
  }

  sync(tiles: readonly AreaTileView[]): void {
    for (const layer of this.layers) layer.sync(tiles);
    this.poisonBubbles.sync(tiles);
  }

  dispose(): void {
    for (const layer of this.layers) layer.dispose();
    this.poisonBubbles.dispose();
  }
}
