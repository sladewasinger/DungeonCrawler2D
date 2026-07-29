import type Phaser from "phaser";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import {
  createAreaFireFlameStack,
  type AreaFireFlamePlacement,
} from "../animation/areaFireFlameStack.js";
import {
  activateAreaEmitters,
  deactivateAreaEmitters,
  destroyAreaEmitters,
  type AreaEmitterControl,
} from "../animation/areaEmitterLifecycle.js";
import {
  areaVisualDepthsForRow,
} from "../presentation/areaVisualDepth.js";
import { areaSurfaceRow, areaSurfaceScreen } from "../presentation/areaSurface.js";
import { createFireEmitters } from "../../particles/particleRecipes.js";
import type { FireFieldComponent } from "./fireFieldTopology.js";
import {
  replenishFireFieldFlames,
  syncFireFieldCore,
} from "./fireFieldFlameLifecycle.js";
import {
  createFireFieldLight,
  initializeFireFieldLight,
  placeFireFieldLight,
  type MutableFireFieldLight,
} from "./fireFieldLight.js";
import { FireUnionEmissionSource } from "./fireUnionEmissionSource.js";

export interface FireFieldRig {
  readonly light: LightSource;
  activate(input: FireRigPlacement): void;
  retarget(input: FireRigPlacement): void;
  contributesLight(): boolean;
  sync(nowMs: number): void;
  deactivate(): void;
  destroy(): void;
}

export interface FireRigPlacement {
  readonly component: FireFieldComponent;
  readonly particleDepth: number;
}

export function createFireFieldRig(
  scene: Phaser.Scene,
  frequencyScale: number,
): FireFieldRig {
  return fireFieldRig(createFireRigResources(scene, frequencyScale));
}

interface FireRigResources {
  readonly flames: ReturnType<typeof createAreaFireFlameStack>;
  readonly emitters: readonly AreaEmitterControl[];
  readonly flameEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly emissionSource: FireUnionEmissionSource;
  readonly light: MutableFireFieldLight;
  readonly placement: MutableFlamePlacement;
}

function createFireRigResources(
  scene: Phaser.Scene,
  frequencyScale: number,
): FireRigResources {
  const flames = createAreaFireFlameStack(scene);
  const emissionSource = new FireUnionEmissionSource();
  const fireEmitters = createFireEmitters({
    scene,
    x: 0,
    y: 0,
    frequencyScale,
    source: emissionSource,
  });
  const light = createFireFieldLight();
  const placement: MutableFlamePlacement = {
    screen: { x: 0, y: 0 },
    depth: 0,
    nowMs: 0,
    phaseOffset: 0,
    showCore: false,
  };
  return {
    flames,
    emitters: fireEmitters.all,
    flameEmitter: fireEmitters.flame,
    emissionSource,
    light,
    placement,
  };
}

function fireFieldRig(resources: FireRigResources): FireFieldRig {
  const { flames, emitters, light, placement } = resources;
  return {
    light,
    activate: (input) => placeRig(resources, input, true),
    retarget: (input) => placeRig(resources, input, false),
    sync: (nowMs) => {
      syncFireFieldCore(flames, placement, nowMs);
      replenishFireFieldFlames(resources.flameEmitter, placement.showCore);
    },
    contributesLight: () => true,
    deactivate: () => {
      flames.deactivate();
      deactivateAreaEmitters(emitters);
    },
    destroy: () => {
      flames.destroy();
      destroyAreaEmitters(emitters);
    },
  };
}

interface MutableFlamePlacement extends AreaFireFlamePlacement {
  depth: number;
  nowMs: number;
  phaseOffset: number;
  showCore: boolean;
  screen: { x: number; y: number };
}

function placeRig(
  resources: FireRigResources,
  input: FireRigPlacement,
  start: boolean,
): void {
  const { emitters, emissionSource, flames, light, placement } = resources;
  const { component, particleDepth } = input;
  const coreTile = component.tiles[0];
  if (!coreTile) throw new Error("fire rig requires a component tile");
  const depths = areaVisualDepthsForRow(areaSurfaceRow(coreTile));
  const coreScreen = areaSurfaceScreen(coreTile);
  placement.screen.x = coreScreen.x;
  placement.screen.y = coreScreen.y;
  placement.depth = depths.fireCore;
  placement.showCore = component.tiles.length === 1;
  if (start) placement.phaseOffset = initializeFireFieldLight(
    light,
    component.signature,
  );
  emissionSource.sync(component, light.id);
  // A multi-cell field has no static core. The single-cell core is centered in
  // its own cell, while every particle birth is boundary-inset by the source.
  // This avoids WebGL-unsupported display masks without allowing visual seams.
  activateAreaEmitters(emitters, {
    screen: EMISSION_ORIGIN,
    depth: particleDepth,
  }, start);
  placeFireFieldLight(light, component);
  if (!placement.showCore) flames.deactivate();
}

const EMISSION_ORIGIN = { x: 0, y: 0 } as const;
