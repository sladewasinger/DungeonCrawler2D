import type Phaser from "phaser";
import { hashSeed, type LightSource } from "../../../render/lighting/core/lightSource.js";
import { getViewOrientation } from "../../../render/view/transform/viewState.js";
import { createSteamEmitter } from "../../particles/particleRecipes.js";
import type { AreaTileView } from "../areaEffectPool.js";
import { areaVisualDepthsForRow } from "../presentation/areaVisualDepth.js";
import {
  areaSurfaceRow,
  areaSurfaceScreen,
} from "../presentation/areaSurface.js";
import {
  AREA_LIGHT_STYLES,
  type AnimatedAreaKind,
} from "../presentation/areaVisualStyle.js";
import {
  activateAreaEmitters,
  deactivateAreaEmitters,
  destroyAreaEmitters,
  type AreaEmitterControl,
} from "./areaEmitterLifecycle.js";
import { shouldRestartAreaRig } from "./areaRigLifecycle.js";

export type AmbientAreaKind = Exclude<AnimatedAreaKind, "fire">;

interface MutableAreaLight {
  id: string;
  x: number;
  y: number;
  color: number;
  radiusTiles: number;
  kind: AmbientAreaKind;
  seed: number;
  groundHeight?: number;
}

export interface AnimatedAreaRig {
  readonly kind: AmbientAreaKind;
  readonly light: LightSource;
  activate(tile: AreaTileView): void;
  deactivate(): void;
  destroy(): void;
}

export type AnimatedAreaRigFactory = (
  kind: AmbientAreaKind,
) => AnimatedAreaRig;

interface AmbientRigState {
  active: boolean;
  placementKey: string;
}

interface AmbientRigContext {
  readonly emitters: readonly AreaEmitterControl[];
  readonly light: MutableAreaLight;
  readonly state: AmbientRigState;
}

export function createAnimatedAreaRig(
  scene: Phaser.Scene,
  kind: AmbientAreaKind,
  frequencyScale: number,
): AnimatedAreaRig {
  const context: AmbientRigContext = {
    emitters: kind === "steam"
      ? [createSteamEmitter({ scene, x: 0, y: 0, frequencyScale })]
      : [],
    light: createAreaLight(kind),
    state: { active: false, placementKey: "" },
  };
  return {
    kind,
    light: context.light,
    activate: (tile) => syncAmbientRig(context, tile),
    deactivate: () => deactivateAmbientRig(context),
    destroy: () => destroyAreaEmitters(context.emitters),
  };
}

function syncAmbientRig(
  context: AmbientRigContext,
  tile: AreaTileView,
): void {
  const orientation = getViewOrientation();
  const placementKey = `${tile.id}:${tile.groundHeight}:${orientation}`;
  const restart = shouldRestartAreaRig(
    context.state.active,
    context.state.placementKey,
    placementKey,
  );
  if (!restart) return;
  const screen = areaSurfaceScreen(tile);
  const row = areaSurfaceRow(tile);
  activateAreaEmitters(context.emitters, {
    screen,
    depth: areaVisualDepthsForRow(row).cloud,
  }, true);
  syncAreaLight(context.light, tile);
  context.state.active = true;
  context.state.placementKey = placementKey;
}

function deactivateAmbientRig(context: AmbientRigContext): void {
  deactivateAreaEmitters(context.emitters);
  context.state.active = false;
  context.state.placementKey = "";
}

function createAreaLight(kind: AmbientAreaKind): MutableAreaLight {
  const style = AREA_LIGHT_STYLES[kind];
  return {
    id: "",
    x: 0,
    y: 0,
    color: style.color,
    radiusTiles: style.radiusTiles,
    kind,
    seed: 0,
  };
}

function syncAreaLight(light: MutableAreaLight, tile: AreaTileView): void {
  light.id = tile.id;
  light.x = tile.x;
  light.y = tile.y;
  light.groundHeight = tile.groundHeight;
  light.seed = hashSeed(tile.id);
}
