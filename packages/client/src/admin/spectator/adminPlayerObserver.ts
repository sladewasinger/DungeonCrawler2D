import type { AdminMap, AdminPlayer } from "@dc2d/engine";
import { text, title } from "../portal/adminPagePrimitives.js";
import {
  clearAdminPlayerActions,
  renderAdminPlayerActions,
} from "./actions/adminPlayerActions.js";
import { createLiveSpectatorAssets, type LiveSpectatorAssets } from "./liveSpectatorAssets.js";
import { renderLiveSpectatorMap } from "./liveSpectatorRenderer.js";
import { adminLiveViewerProjection } from "./adminLiveViewerProjection.js";

export interface AdminPlayerObserver {
  readonly root: HTMLElement;
  render(input: AdminPlayerObserverRenderInput): void;
  centerCamera(): void;
  zoomCamera(direction: "in" | "out"): void;
}

export interface AdminPlayerObserverRenderInput {
  readonly player: AdminPlayer | null;
  readonly spectatorPlayer: AdminPlayer | null;
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
  readonly context: CanvasRenderingContext2D;
  readonly assets: LiveSpectatorAssets;
}

export function createAdminPlayerObserver(): AdminPlayerObserver {
  let latestInput: AdminPlayerObserverRenderInput | null = null;
  let zoom = 1;
  let redraw = (): void => {};
  const elements = createElements(() => redraw());
  redraw = (): void => {
    if (latestInput) renderObserver({ elements, input: latestInput, zoom });
  };
  return {
    root: elements.root,
    render: (input) => {
      latestInput = input;
      redraw();
    },
    centerCamera: redraw,
    zoomCamera: (direction) => {
      zoom = nextLiveSpectatorZoom(zoom, direction);
      redraw();
    },
  };
}

function createElements(onAssetLoad: () => void): ObserverElements {
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
  canvas.width = 800;
  canvas.height = 450;
  canvas.dataset.adminSpectatorCanvas = "";
  canvas.setAttribute("aria-label", "Live spectator map");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Admin spectator canvas is unavailable.");
  const assets = createLiveSpectatorAssets(onAssetLoad);
  viewer.append(liveStatus, canvas);
  root.append(heading, details, actions, viewer);
  return { root, heading, details, actions, viewer, liveStatus, canvas, context, assets };
}

interface RenderObserverInput {
  readonly elements: ObserverElements;
  readonly input: AdminPlayerObserverRenderInput;
  readonly zoom: number;
}

function renderObserver({ elements, input, zoom }: RenderObserverInput): void {
  renderPlayerControls(elements, input);
  renderLiveViewer({ elements, input, zoom });
}

function renderPlayerControls(
  elements: ObserverElements,
  input: AdminPlayerObserverRenderInput,
): void {
  if (!input.player) return renderEmptyControls(elements);
  elements.heading.textContent = input.player.name;
  elements.details.textContent = playerSummary(input.player);
  renderAdminPlayerActions({
    actions: elements.actions,
    player: input.player,
    authenticated: input.authenticated,
    tracking: isTracking(input),
    spectatorMode: input.spectatorMode,
  });
}

function renderEmptyControls(elements: ObserverElements): void {
  elements.heading.textContent = "Player controls";
  elements.details.textContent = "Select a connected player to manage their session.";
  clearAdminPlayerActions(elements.actions);
}

function renderLiveViewer(input: RenderObserverInput): void {
  const { elements } = input;
  const projection = adminLiveViewerProjection(input.input, input.zoom);
  elements.viewer.dataset.live = String(projection.active);
  elements.liveStatus.textContent = liveStatus(input.input);
  renderLiveSpectatorMap({
    context: elements.context,
    map: projection.map,
    targetId: projection.targetId,
    atlas: elements.assets.atlas,
    terrain: elements.assets.terrain,
    pets: elements.assets.pets,
    zoom: projection.zoom,
  });
}

function nextLiveSpectatorZoom(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? 0.15 : -0.15;
  return Math.max(0.7, Math.min(1.8, current + delta));
}

function isTracking(input: AdminPlayerObserverRenderInput): boolean {
  return input.spectatorMode === "track" && input.spectatorTargetId === input.player?.playerId;
}

function playerSummary(player: AdminPlayer): string {
  const state = player.downed ? "Downed" : "Alive"; return `${state} · ${player.hp}/${player.maxHp} HP · ${player.level} floor ${player.floor} · ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`;
}

function liveStatus(input: AdminPlayerObserverRenderInput): string {
  if (input.spectatorMode === "off") return "Camera idle · turn Spectate on to begin";
  const camera = input.spectatorMode === "free"
    ? "Free camera"
    : input.spectatorPlayer?.name ?? "Player camera";
  return `${camera} · full in-game view`;
}
