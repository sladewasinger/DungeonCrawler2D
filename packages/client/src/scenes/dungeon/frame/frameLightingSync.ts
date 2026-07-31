import type Phaser from "phaser";
import { projectTorchGroundAnchor } from "../../../render/entities/presentation/torch/groundAnchor.js";
import type { LightSource } from "../../../render/lighting/core/lightSource.js";
import {
  visibleAreaMarginPx,
  visibleAreaViews,
} from "../world/areas/visibleAreaViews.js";
import { applyVisualEvents } from "../visuals/visualEvents.js";
import { syncExpiredWhiffs } from "./effects/expiredSwings.js";
import { syncSelfVfx } from "./frameSelfVfx.js";
import type { FrameSyncContext } from "./frameSync.js";

export function syncLightingAndVfx(
  context: FrameSyncContext,
  torchAccentLights: LightSource[],
): void {
  applyVisualEvents({ ...context, pendingSwings: context.state.pendingSwings });
  if (!context.lighting || !context.conn.body) return;
  updateLighting(context, torchAccentLights);
  syncVisibleTorchFlames(context);
  syncExpiredWhiffs(context);
  syncSelfVfx(context);
}

function updateLighting(
  context: FrameSyncContext,
  torchAccentLights: LightSource[],
): void {
  const { conn, lighting, vfx, scene, state, nowMs, render } = context;
  if (!lighting || !conn.world) return;
  const areaLights = vfx.syncAreas(visibleAreaViews({
    connection: conn,
    world: conn.world,
    state,
    view: scene.cameras.main.worldView,
    constrainedPresentation: context.terrain?.constrainedPresentation === true,
    terrainVisibility: lighting.isToonActive() ? lighting : undefined,
  }));
  state.accentLights.length = 0;
  state.accentLights.push(...areaLights, ...torchAccentLights);
  lighting.setAccentLights(state.accentLights);
  lighting.update({
    view: scene.cameras.main.worldView,
    personal: render,
    nowMs,
  });
}

function syncVisibleTorchFlames(context: FrameSyncContext): void {
  const { lighting, scene, state, vfx } = context;
  if (!lighting) return;
  const visible = state.visibleTorchLights;
  visible.length = 0;
  const view = scene.cameras.main.worldView;
  const constrained = context.terrain?.constrainedPresentation === true;
  for (const torch of lighting.activeTorches()) {
    if (torchVisibleToon(lighting, torch) &&
        torchInCameraView(torch, view, constrained)) {
      visible.push(torch);
    }
  }
  vfx.syncTorchFlames(visible);
}

function torchVisibleToon(
  lighting: NonNullable<FrameSyncContext["lighting"]>,
  torch: LightSource,
): boolean {
  return !lighting.isToonActive() || lighting.isToonVisible(torch.x, torch.y);
}

export function torchInCameraView(
  torch: LightSource,
  view: Phaser.Geom.Rectangle,
  constrainedPresentation: boolean,
): boolean {
  const anchor = projectTorchGroundAnchor({
    x: torch.x,
    y: torch.y,
    groundHeight: torch.groundHeight ?? 0,
  });
  const margin = visibleAreaMarginPx(constrainedPresentation);
  return anchor.x >= view.x - margin && anchor.x <= view.right + margin &&
    anchor.y >= view.y - margin && anchor.y <= view.bottom + margin;
}
