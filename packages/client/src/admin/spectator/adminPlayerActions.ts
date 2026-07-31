import type { AdminPlayer } from "@dc2d/engine";
import { actionButton, controlFieldset } from "../adminPagePrimitives.js";
import {
  combatActionGroup,
  positionActionGroup,
} from "./controls/adminPlayerParameterizedActions.js";

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
      definitions: spectatorActions(input.spectatorMode),
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

function spectatorActions(mode: AdminPlayerActionsInput["spectatorMode"]): readonly ActionDefinition[] {
  if (mode === "off") return [["Spectate", "spectate", false]];
  if (mode === "free") return [
    ["Spectate", "spectator-stop", true],
    ["Free camera", "spectate", true],
    ["Center on player", "spectator-center"],
    ["Previous player", "spectator-previous"],
    ["Next player", "spectator-next"],
  ];
  return [
    ["Spectate", "spectator-stop", true],
    ["Free camera", "spectator-free", false],
    ["Previous player", "spectator-previous"],
    ["Next player", "spectator-next"],
  ];
}

function modeActions(player: AdminPlayer): readonly ActionDefinition[] {
  return [
    [player.god ? "God off" : "God on", player.god ? "god-off" : "god-on"],
    [player.handicapped ? "Handicap off" : "Handicap on", player.handicapped ? "handicap-off" : "handicap-on"],
    [player.admin ? "Revoke Admin" : "Grant Admin", player.admin ? "admin-off" : "admin-on"],
  ];
}

type ActionDefinition = readonly [label: string, action: string, pressed?: boolean];

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
    control.setAttribute("aria-pressed", String(input.pressed));
  }
  return control;
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
