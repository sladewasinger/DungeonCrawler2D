import type { AdminPlayer } from "@dc2d/engine";
import { actionButton } from "../adminPagePrimitives.js";

export interface AdminPlayerActionsInput {
  readonly actions: HTMLElement;
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
  readonly tracking: boolean;
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
  const { player, authenticated, tracking } = input;
  return [
    actionGroup({
      label: "Spectator",
      definitions: spectatorActions(tracking),
      playerId: player.playerId,
      authenticated,
    }),
    actionGroup({
      label: "Position",
      definitions: positionActions(),
      playerId: player.playerId,
      authenticated,
    }),
    actionGroup({
      label: "Health & combat",
      definitions: combatActions(),
      playerId: player.playerId,
      authenticated,
    }),
    actionGroup({
      label: "Player modes",
      definitions: modeActions(player),
      playerId: player.playerId,
      authenticated,
    }),
  ];
}

function spectatorActions(tracking: boolean): readonly ActionDefinition[] {
  if (!tracking) return [["Spectate player", "spectate"]];
  return [
    ["Stop spectating", "spectator-stop"],
    ["Previous player", "spectator-previous"],
    ["Next player", "spectator-next"],
  ];
}

function positionActions(): readonly ActionDefinition[] {
  return [["Send to spawn", "teleport-spawn"], ["Send to safe room", "teleport-safe"]];
}

function combatActions(): readonly ActionDefinition[] {
  return [["Heal", "heal"], ["Kill", "kill"], ["Kill nearby enemies", "kill-enemies"]];
}

function modeActions(player: AdminPlayer): readonly ActionDefinition[] {
  return [
    [player.god ? "God off" : "God on", player.god ? "god-off" : "god-on"],
    [player.handicapped ? "Handicap off" : "Handicap on", player.handicapped ? "handicap-off" : "handicap-on"],
    [player.admin ? "Revoke Admin" : "Grant Admin", player.admin ? "admin-off" : "admin-on"],
  ];
}

type ActionDefinition = readonly [label: string, action: string];

interface ActionGroupInput {
  readonly label: string;
  readonly definitions: readonly ActionDefinition[];
  readonly playerId: string;
  readonly authenticated: boolean;
}

function actionGroup(input: ActionGroupInput): HTMLElement {
  const group = document.createElement("section");
  group.dataset.adminActionGroup = "";
  group.setAttribute("aria-label", input.label);
  const heading = document.createElement("h2");
  heading.textContent = input.label;
  const controls = input.definitions.map(([controlLabel, action]) => actionControl({
    label: controlLabel,
    action,
    playerId: input.playerId,
    authenticated: input.authenticated,
  }));
  group.append(heading, ...controls);
  return group;
}

interface ActionControlInput {
  readonly label: string;
  readonly action: string;
  readonly playerId: string;
  readonly authenticated: boolean;
}

function actionControl(input: ActionControlInput): HTMLButtonElement {
  const control = actionButton(input.label, input.action);
  control.dataset.playerId = input.playerId;
  control.disabled = !input.authenticated;
  return control;
}

function actionStateKey(input: AdminPlayerActionsInput): string {
  const { player } = input;
  return [
    player.playerId,
    input.authenticated,
    input.tracking,
    player.god,
    player.handicapped,
    player.admin,
  ].join(":");
}
