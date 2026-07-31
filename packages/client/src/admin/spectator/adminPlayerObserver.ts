import type { AdminMap, AdminPlayer } from "@dc2d/engine";
import { text, title } from "../adminPagePrimitives.js";
import {
  clearAdminPlayerActions,
  renderAdminPlayerActions,
} from "./actions/adminPlayerActions.js";
import { FullSpectatorEmbed } from "./fullSpectatorEmbed.js";

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
  readonly embed: FullSpectatorEmbed;
}

export function createAdminPlayerObserver(): AdminPlayerObserver {
  const elements = createElements();
  return {
    root: elements.root,
    render: (input) => renderObserver({ elements, input }),
    centerCamera: () => elements.embed.centerOnPlayer(),
    zoomCamera: (direction) => elements.embed.zoom(direction),
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
  const embed = new FullSpectatorEmbed();
  viewer.append(liveStatus, embed.element);
  root.append(heading, details, actions, viewer);
  return { root, heading, details, actions, viewer, liveStatus, embed };
}

interface RenderObserverInput {
  readonly elements: ObserverElements;
  readonly input: AdminPlayerObserverRenderInput;
}

function renderObserver({ elements, input }: RenderObserverInput): void {
  renderPlayerControls(elements, input);
  renderLiveViewer({ elements, input });
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
  const active = input.input.spectatorMode !== "off";
  elements.viewer.dataset.live = String(active);
  elements.liveStatus.textContent = liveStatus(input.input);
  elements.embed.update({
    active,
    playerId: input.input.spectatorTargetId ?? input.input.player?.playerId ?? null,
    mode: input.input.spectatorMode,
  });
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
