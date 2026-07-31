import type { AdminPlayer } from "@dc2d/engine";
import { actionButton, controlFieldset } from "../../adminPagePrimitives.js";
import {
  combatActionGroup,
  positionActionGroup,
} from "../controls/adminPlayerParameterizedActions.js";
import { configureAdminToggle } from "./adminToggleControl.js";

const SPECTATOR_TOGGLE_ACTION = "spectator-toggle";
const SPECTATOR_ZOOM_OUT_ACTION = "spectator-zoom-out";
const SPECTATOR_ZOOM_IN_ACTION = "spectator-zoom-in";

export interface AdminPlayerActionsInput {
  readonly actions: HTMLElement;
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
  readonly tracking: boolean;
  readonly spectatorMode: "off" | "free" | "track";
}

export function renderAdminPlayerActions(input: AdminPlayerActionsInput): void {
  const key = actionStateKey(input);
  if (input.actions.dataset.actionState === key) return;
  input.actions.dataset.actionState = key;
  input.actions.replaceChildren(...actionGroups(input));
}

export function clearAdminPlayerActions(actions: HTMLElement): void {
  if (actions.dataset.actionState === "empty") return;
  actions.dataset.actionState = "empty";
  actions.replaceChildren();
}

function actionGroups(input: AdminPlayerActionsInput): readonly HTMLElement[] {
  const { player, authenticated } = input;
  return [
    actionGroup({
      label: "Spectator",
      definitions: adminSpectatorActions(input.spectatorMode),
      playerId: player.playerId,
      authenticated,
    }),
    positionActionGroup({ player, authenticated }),
    combatActionGroup({ player, authenticated }),
    actionGroup({
      label: "Player modes",
      definitions: modeActions(player),
      playerId: player.playerId,
      authenticated,
    }),
  ];
}

export function adminSpectatorActions(
  mode: AdminPlayerActionsInput["spectatorMode"],
): readonly ActionDefinition[] {
  if (mode === "off") return [["Spectate", SPECTATOR_TOGGLE_ACTION, false]];
  if (mode === "free") return [
    ["Spectate", SPECTATOR_TOGGLE_ACTION, true],
    ["Free camera", "spectate", true],
    ["Center on player", "spectator-center"],
    ["Previous player", "spectator-previous"],
    ["Next player", "spectator-next"],
    ["−", SPECTATOR_ZOOM_OUT_ACTION],
    ["+", SPECTATOR_ZOOM_IN_ACTION],
  ];
  return [
    ["Spectate", SPECTATOR_TOGGLE_ACTION, true],
    ["Free camera", "spectator-free", false],
    ["Previous player", "spectator-previous"],
    ["Next player", "spectator-next"],
    ["−", SPECTATOR_ZOOM_OUT_ACTION],
    ["+", SPECTATOR_ZOOM_IN_ACTION],
  ];
}

function modeActions(player: AdminPlayer): readonly ActionDefinition[] {
  return [
    [player.god ? "God off" : "God on", player.god ? "god-off" : "god-on"],
    [player.handicapped ? "Handicap off" : "Handicap on", player.handicapped ? "handicap-off" : "handicap-on"],
    [player.admin ? "Revoke Admin" : "Grant Admin", player.admin ? "admin-off" : "admin-on"],
  ];
}

export type ActionDefinition = readonly [label: string, action: string, pressed?: boolean];

interface ActionGroupInput {
  readonly label: string;
  readonly definitions: readonly ActionDefinition[];
  readonly playerId: string;
  readonly authenticated: boolean;
}

function actionGroup(input: ActionGroupInput): HTMLElement {
  const group = controlFieldset(input.label);
  group.dataset.adminActionGroup = "";
  const controls = input.definitions.map(([controlLabel, action, pressed]) => actionControl({
    label: controlLabel,
    action,
    playerId: input.playerId,
    authenticated: input.authenticated,
    ...(pressed === undefined ? {} : { pressed }),
  }));
  group.append(...controls);
  return group;
}

interface ActionControlInput {
  readonly label: string;
  readonly action: string;
  readonly playerId: string;
  readonly authenticated: boolean;
  readonly pressed?: boolean;
}

function actionControl(input: ActionControlInput): HTMLButtonElement {
  const control = actionButton(input.label, input.action);
  control.dataset.playerId = input.playerId;
  control.disabled = !input.authenticated;
  if (input.pressed !== undefined) {
    configureAdminToggle(control, input.label, input.pressed);
  }
  describeZoomControl(control, input.action);
  return control;
}

function describeZoomControl(control: HTMLButtonElement, action: string): void {
  const label = action === SPECTATOR_ZOOM_IN_ACTION
    ? "Zoom spectator camera in"
    : action === SPECTATOR_ZOOM_OUT_ACTION ? "Zoom spectator camera out" : null;
  if (!label) return;
  control.dataset.adminSpectatorZoom = "";
  control.title = label;
  control.setAttribute("aria-label", label);
}

function actionStateKey(input: AdminPlayerActionsInput): string {
  const { player } = input;
  return [
    player.playerId,
    input.authenticated,
    input.tracking,
    input.spectatorMode,
    player.god,
    player.handicapped,
    player.admin,
  ].join(":");
}
