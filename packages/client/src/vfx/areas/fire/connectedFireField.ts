import type Phaser from "phaser";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import { getViewOrientation } from "../../../render/view/transform/viewState.js";
import type { AreaTileView } from "../areaEffectPool.js";
import {
  defaultAreaVisualBudget,
  type AreaVisualBudget,
} from "../presentation/areaVisualBudget.js";
import { luminousFireParticleDepth } from "../presentation/areaVisualDepth.js";
import {
  reconcileFireComponents,
  type ActiveFireComponent,
} from "./connectedFireFieldReconciliation.js";
import { createFireFieldRig, type FireFieldRig } from "./fireFieldRig.js";
import {
  buildFireFieldComponents,
  fireFieldTopologyHash,
} from "./fireFieldTopology.js";

export class ConnectedFireField {
  private active = new Map<string, ActiveFireComponent>();
  private readonly spareRigs: FireFieldRig[] = [];
  private readonly lights: LightSource[] = [];
  private topologyHash = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly budget: AreaVisualBudget = defaultAreaVisualBudget(),
    private readonly particleDepth: number = luminousFireParticleDepth(),
  ) {}

  sync(tiles: readonly AreaTileView[]): LightSource[] {
    const orientation = getViewOrientation();
    const hash = fireFieldTopologyHash(tiles, orientation);
    if (hash !== this.topologyHash) {
      this.rebuild(tiles, orientation);
      this.topologyHash = hash;
    }
    this.lights.length = 0;
    const nowMs = this.scene.time.now;
    for (const component of this.active.values()) {
      component.rig.sync(nowMs);
      if (component.rig.contributesLight()) this.lights.push(component.rig.light);
    }
    return this.lights;
  }

  private rebuild(
    tiles: readonly AreaTileView[],
    orientation: ReturnType<typeof getViewOrientation>,
  ): void {
    const components = buildFireFieldComponents(tiles, orientation);
    this.active = reconcileFireComponents({
      components,
      maximumComponents: this.budget.maximumFireRigs,
      particleDepth: this.particleDepth,
      active: this.active,
      acquireRig: () => this.acquireRig(),
      releaseRig: (rig) => this.releaseRig(rig),
    });
  }

  private acquireRig(): FireFieldRig {
    return this.spareRigs.pop() ?? createFireFieldRig(
      this.scene,
      this.budget.emissionFrequencyScale,
    );
  }

  private releaseRig(rig: FireFieldRig): void {
    rig.deactivate();
    if (this.spareRigs.length < this.budget.maximumSpareRigsPerKind) {
      this.spareRigs.push(rig);
    } else rig.destroy();
  }

  dispose(): void {
    for (const component of this.active.values()) {
      component.rig.destroy();
    }
    for (const rig of this.spareRigs) rig.destroy();
    this.active.clear();
    this.spareRigs.length = 0;
    this.lights.length = 0;
  }
}
