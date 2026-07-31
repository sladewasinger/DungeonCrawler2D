import type { AdminMap, AdminPlayer } from "@dc2d/engine";
import { text, title } from "../adminPagePrimitives.js";
import {
  clearAdminPlayerActions,
  renderAdminPlayerActions,
} from "./adminPlayerActions.js";
import { createLiveSpectatorAssets, type LiveSpectatorAssets } from "./liveSpectatorAssets.js";
import { renderLiveSpectatorMap } from "./liveSpectatorRenderer.js";

export interface AdminPlayerObserver {
  readonly root: HTMLElement;
  render(input: AdminPlayerObserverRenderInput): void;
}

export interface AdminPlayerObserverRenderInput {
  readonly player: AdminPlayer | null;
  readonly authenticated: boolean;
  readonly spectatorMode: "off" | "free" | "track";
  readonly spectatorTargetId: string | null;
  readonly spectatorMap: AdminMap | null;
}

interface ObserverElements {
  readonly root: HTMLElement;
  readonly heading: HTMLElement;
  readonly details: HTMLElement;
  readonly actions: HTMLElement;
  readonly viewer: HTMLElement;
  readonly liveStatus: HTMLElement;
  readonly canvas: HTMLCanvasElement;
}

export function createAdminPlayerObserver(): AdminPlayerObserver {
  const elements = createElements();
  let liveFrame: LiveFrame = { map: null, targetId: null };
  const assets = createLiveSpectatorAssets(() => drawLiveFrame({ canvas: elements.canvas, assets, frame: liveFrame }));
  return {
    root: elements.root,
    render: (input) => {
      liveFrame = { map: input.spectatorMap, targetId: input.spectatorTargetId };
      renderObserver({ elements, assets, input });
    },
  };
}

function createElements(): ObserverElements {
  const root = document.createElement("section");
  root.dataset.adminPlayerObserver = "";
  const heading = title("Player controls");
  const details = text("Select a connected player to inspect their live state.");
  details.dataset.adminPlayerDetails = "";
  const actions = document.createElement("div");
  actions.dataset.adminPlayerActions = "";
  const viewer = document.createElement("div");
  viewer.dataset.adminSpectatorViewer = "";
  const liveStatus = text("Not spectating");
  liveStatus.dataset.adminSpectatorStatus = "";
  liveStatus.setAttribute("aria-live", "polite");
  const canvas = document.createElement("canvas");
  canvas.width = 504;
  canvas.height = 504;
  canvas.dataset.adminSpectatorCanvas = "";
  canvas.setAttribute("aria-label", "Live spectator view");
  viewer.append(liveStatus, canvas);
  root.append(heading, details, actions, viewer);
  return { root, heading, details, actions, viewer, liveStatus, canvas };
}

interface LiveFrame {
  readonly map: AdminMap | null;
  readonly targetId: string | null;
}

interface RenderObserverInput {
  readonly elements: ObserverElements;
  readonly assets: LiveSpectatorAssets;
  readonly input: AdminPlayerObserverRenderInput;
}

function renderObserver({ elements, assets, input }: RenderObserverInput): void {
  if (!input.player) return renderEmpty({ elements, assets });
  const tracking = isTracking(input);
  elements.heading.textContent = input.player.name;
  elements.details.textContent = playerSummary(input.player);
  renderAdminPlayerActions({ actions: elements.actions, player: input.player, authenticated: input.authenticated, tracking });
  renderLiveViewer({ elements, assets, input, tracking });
}

function renderEmpty(input: Pick<RenderObserverInput, "elements" | "assets">): void {
  const { elements, assets } = input;
  elements.heading.textContent = "Player controls";
  elements.details.textContent = "Select a connected player to manage their session or start a spectator camera.";
  clearAdminPlayerActions(elements.actions);
  elements.viewer.dataset.live = "false";
  elements.liveStatus.textContent = "Camera idle · select a player to begin";
  drawLiveFrame({ canvas: elements.canvas, assets, frame: { map: null, targetId: null } });
}

function renderLiveViewer(input: RenderObserverInput & { readonly tracking: boolean }): void {
  const { elements, assets, tracking } = input;
  elements.viewer.dataset.live = String(tracking);
  elements.liveStatus.textContent = tracking
    ? liveStatus(input.input.player!, input.input.spectatorMap)
    : "Camera idle · use Spectate player to begin";
  const frame = tracking ? frameFromObserver(input.input) : { map: null, targetId: null };
  drawLiveFrame({ canvas: elements.canvas, assets, frame });
}

function isTracking(input: AdminPlayerObserverRenderInput): boolean {
  return input.spectatorMode === "track" && input.spectatorTargetId === input.player?.playerId;
}

function playerSummary(player: AdminPlayer): string {
  const state = player.downed ? "Downed" : "Alive"; return `${state} · ${player.hp}/${player.maxHp} HP · ${player.level} floor ${player.floor} · ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`;
}

function liveStatus(player: AdminPlayer, map: AdminMap | null): string {
  if (!map) return `Waiting for ${player.name}'s live feed…`;
  return `Live · ${map.level} floor ${map.floor} · ${map.entities.length} nearby entities`;
}

function frameFromObserver(input: AdminPlayerObserverRenderInput): LiveFrame {
  return { map: input.spectatorMap, targetId: input.spectatorTargetId };
}

function drawLiveFrame(input: { readonly canvas: HTMLCanvasElement; readonly assets: LiveSpectatorAssets; readonly frame: LiveFrame }): void {
  renderLiveSpectatorMap({
    context: input.canvas.getContext("2d")!,
    map: input.frame.map,
    targetId: input.frame.targetId,
    atlas: input.assets.atlas,
    terrain: input.assets.terrain,
  });
}
