/** Coordinates terrain prop animation and world-space drifting cloud shadows. */
import type Phaser from "phaser";
import type { ViewRect } from "../../streaming/streaming.js";
import type { TerrainRoot } from "../root.js";
import { ForestCloudShadows } from "./cloudShadows.js";
import { animateForestTerrainProps } from "./forestPropAnimation.js";

export class TerrainAtmosphere {
  private readonly cloudShadows: ForestCloudShadows;

  constructor(private readonly scene: Phaser.Scene) {
    this.cloudShadows = new ForestCloudShadows(scene);
  }

  update(input: {
    readonly roots: Iterable<TerrainRoot>;
    readonly view: ViewRect;
    readonly roomIsolation: boolean;
  }): void {
    const nowMs = this.scene.time?.now ?? performance.now();
    this.cloudShadows.update(input.view, nowMs, !input.roomIsolation);
    for (const root of input.roots) {
      animateForestTerrainProps(root.props.values(), nowMs);
    }
  }

  dispose(): void {
    this.cloudShadows.dispose();
  }
}
