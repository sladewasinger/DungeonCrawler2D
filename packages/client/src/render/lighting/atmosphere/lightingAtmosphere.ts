import type Phaser from "phaser";
import type { GroundLightRevealCell } from "../ground/groundLightTypes.js";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import { AtmosphericMotes } from "./atmosphericMotes.js";
import { DarknessPass } from "./darknessPass.js";
import { FogLayers } from "./fogLayers.js";
import type { LightingAtmosphereBudget } from "./lightingAtmosphereBudget.js";

export interface LightingAtmosphereFrame {
  readonly enabled: boolean;
  readonly overlayDepth: number;
  readonly nowMs: number;
  readonly revealCells: readonly GroundLightRevealCell[];
  readonly revealChanged: boolean;
}

/** Owns the three camera-scale atmosphere layers as one lifecycle unit. */
export class LightingAtmosphere {
  private readonly darkness: DarknessPass;
  private readonly fog: FogLayers;
  private readonly motes: AtmosphericMotes;

  constructor(
    scene: Phaser.Scene,
    private readonly budget: LightingAtmosphereBudget,
    private readonly reducedMotion: boolean,
  ) {
    this.darkness = new DarknessPass(scene);
    this.fog = new FogLayers(scene, budget.fogLayerCount);
    this.motes = new AtmosphericMotes(scene, budget.maximumParticles);
  }

  update(frame: LightingAtmosphereFrame): void {
    const darknessDepth = frame.overlayDepth -
      LIGHTING_VISUAL_STYLE.darkness.overlayDepthGap;
    this.darkness.update({
      enabled: frame.enabled,
      downscale: this.budget.darknessDownscale,
      depth: darknessDepth,
      revealCells: frame.revealCells,
      revealChanged: frame.revealChanged,
    });
    this.fog.update({
      enabled: frame.enabled,
      depth: darknessDepth + 0.1,
      nowMs: frame.nowMs,
      reducedMotion: this.reducedMotion,
    });
    this.motes.update({ enabled: frame.enabled, depth: darknessDepth + 0.25 });
  }

  dispose(): void {
    this.darkness.dispose();
    this.fog.dispose();
    this.motes.dispose();
  }
}
