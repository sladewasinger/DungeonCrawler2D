import combatHurtboxTuning from "./combatHurtboxTuning.json" with { type: "json" };

interface ConfiguredCombatHurtbox {
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly height: number;
  readonly bottomOffset: number;
}

interface CombatHurtboxTuning {
  readonly presentation: {
    readonly sourceTilePixels: number;
    readonly renderScale: number;
    readonly renderedEdgePixels: number;
  };
  readonly player: ConfiguredCombatHurtbox;
  readonly enemy: ConfiguredCombatHurtbox;
  readonly default: ConfiguredCombatHurtbox;
}

/**
 * Hurtbox dimensions in world tiles. With 16px art at 3×, two rendered
 * edge pixels equal 2/48 tile: players inset each edge, enemies pad each edge.
 * Signed bottomOffset keeps vertical padding symmetric around feet-anchored art.
 */
export const COMBAT_HURTBOX_TUNING: CombatHurtboxTuning = combatHurtboxTuning;
