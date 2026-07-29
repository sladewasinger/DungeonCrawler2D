import {
  LIGHTING_VISUAL_STYLE,
  lightingColor,
} from "./lightingVisualStyle.js";

type PlayerLightStyle = typeof LIGHTING_VISUAL_STYLE.playerLight.baseline;

export interface PlayerHotbarSelection {
  readonly hotbar: readonly (string | null | undefined)[];
  readonly selectedSlot: number | null;
}

export interface MutablePlayerLight {
  color: number;
  radiusTiles: number;
  revealRadiusTiles?: number;
  revealCellRadiusTiles?: number;
  revealCellAlpha?: number;
  sourceRevealCellRadiusTiles?: number;
  sourceRevealCellAlpha?: number;
  haloAlphaMultiplier?: number;
  haloScaleMultiplier?: number;
}

/** Client presentation only: a selected torch changes the local carried-light mode. */
export function playerCarriesTorch(selection: PlayerHotbarSelection): boolean {
  return selection.selectedSlot !== null &&
    selection.hotbar[selection.selectedSlot] === "torch";
}

export function applyPlayerLightMode(
  light: MutablePlayerLight,
  carriesTorch: boolean,
): void {
  const style = carriesTorch
    ? LIGHTING_VISUAL_STYLE.playerLight.carriedTorch
    : LIGHTING_VISUAL_STYLE.playerLight.baseline;
  applyPlayerLightStyle(light, style);
}

function applyPlayerLightStyle(
  light: MutablePlayerLight,
  style: PlayerLightStyle,
): void {
  light.color = lightingColor(style.color);
  light.radiusTiles = style.haloRadiusTiles;
  light.revealRadiusTiles = style.revealRadiusTiles;
  light.revealCellRadiusTiles = style.revealCellRadiusTiles;
  light.revealCellAlpha = style.revealCellAlpha;
  light.sourceRevealCellRadiusTiles = style.sourceRevealCellRadiusTiles;
  light.sourceRevealCellAlpha = style.sourceRevealCellAlpha;
  light.haloAlphaMultiplier = style.haloAlphaMultiplier;
  light.haloScaleMultiplier = style.haloScaleMultiplier;
}
