import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import {
  HP_BAR_DISPLAY_HEIGHT_PX,
  updateHpBar,
} from "../presentation/hpBar.js";
import { resolveHpBarVisibility } from "../presentation/hpBarVisibility.js";
import {
  LABEL_LINE_GAP_PX,
  NAMEPLATE_GAP_PX,
  NAMEPLATE_LINE_HEIGHT_PX,
  updateNameplate,
} from "../presentation/nameplate.js";
import { syncOcclusionSilhouette, terrainOcclusionAhead } from "../geometry/occlusion.js";
import { updateShadowPosition } from "../geometry/shadow.js";
import type { PlayerVisual } from "../visuals/state.js";
import type { PlayerEntityView, RenderContext } from "../visuals/view.js";
import { spriteLiftPx } from "../motion/lift.js";
import { worldToScreen } from "../geometry/worldToScreen.js";
import { getViewOrientation } from "../../view/transform/viewState.js";

export interface PlayerChromeUpdate {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly context: RenderContext;
  readonly heightAboveGround: number;
  readonly groundHeight: number;
}

export function updatePlayerChrome({
  visual,
  view,
  context,
  heightAboveGround,
  groundHeight,
}: PlayerChromeUpdate): void {
  updateChromeDepths(visual);
  updatePlayerShadow({ visual, view, heightAboveGround, groundHeight });
  updatePlayerHealthBar(visual, view);
  updatePlayerNameplate(visual, view, context);
  syncPlayerOcclusion(visual, view, context);
}

function updateChromeDepths(visual: PlayerVisual): void {
  const bodyDepth = visual.body.depth;
  visual.shadow.setDepth(bodyDepth - 0.2);
  visual.hpBar.container.setDepth(bodyDepth + 0.2);
  visual.nameplate.setDepth(bodyDepth + 0.2);
}

interface PlayerShadowUpdate {
  readonly visual: PlayerVisual;
  readonly view: PlayerEntityView;
  readonly heightAboveGround: number;
  readonly groundHeight: number;
}

function updatePlayerShadow({
  visual,
  view,
  heightAboveGround,
  groundHeight,
}: PlayerShadowUpdate): void {
  const ground = worldToScreen(view.x, view.y);
  updateShadowPosition({
    shadow: visual.shadow,
    groundScreenX: ground.x,
    groundScreenY: ground.y - spriteLiftPx(groundHeight),
    heightAboveGround,
  });
}

function updatePlayerHealthBar(visual: PlayerVisual, view: PlayerEntityView): void {
  const headY = visual.body.y - visual.body.displayHeight;
  const healthBarY = headY + SCREEN_TILE_PX / 3 - NAMEPLATE_GAP_PX - NAMEPLATE_LINE_HEIGHT_PX - LABEL_LINE_GAP_PX - HP_BAR_DISPLAY_HEIGHT_PX / 2;
  updateHpBar({ bar: visual.hpBar, screenX: visual.body.x, screenY: healthBarY, hp: view.hp, maxHp: view.maxHp });
  visual.hpBarRevealed = resolveHpBarVisibility({
    previousHp: visual.lastHp,
    hp: view.hp,
    maxHp: view.maxHp,
    revealed: visual.hpBarRevealed,
  });
  visual.hpBar.container.setVisible(visual.hpBarRevealed);
}

function updatePlayerNameplate(visual: PlayerVisual, view: PlayerEntityView, context: RenderContext): void {
  const headY = visual.body.y - visual.body.displayHeight;
  updateNameplate({
    text: visual.nameplate,
    name: view.name,
    headScreenX: visual.body.x,
    headScreenY: headY + SCREEN_TILE_PX / 3,
    distanceTiles: Math.hypot(view.x - context.selfX, view.y - context.selfY),
    isParty: context.partyIds.has(view.id),
    downed: view.downed,
    disconnected: view.disconnected ?? false,
  });
}

function syncPlayerOcclusion(visual: PlayerVisual, view: PlayerEntityView, context: RenderContext): void {
  const occlusion = terrainOcclusionAhead({
    world: context.world,
    x: view.x,
    y: view.y,
    z: view.z,
    orientation: getViewOrientation(),
  });
  syncOcclusionSilhouette(visual.body, view.y, occlusion);
}
