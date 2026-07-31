import type { AdminPlayer } from "@dc2d/engine";
import { actionButton } from "../adminPagePrimitives.js";

export interface AdminPlayerActionsInput {
  readonly actions: HTMLElement;
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
  readonly tracking: boolean;
}

export function renderAdminPlayerActions(input: AdminPlayerActionsInput): void {
  const actions = playerActions(input.player, input.tracking);
  const controls = actions.map(([label, action]) => actionButton(label, action));
  for (const [index, control] of controls.entries()) {
    control.dataset.playerId = input.player.playerId;
    control.disabled = !input.authenticated || (actions[index]![1] === "spectate" && input.tracking);
  }
  input.actions.replaceChildren(...controls);
}

export function appendSpectatorControls(actions: HTMLElement, authenticated: boolean): void {
  const controls = [
    actionButton("Previous player", "spectator-previous"),
    actionButton("Next player", "spectator-next"),
    actionButton("Stop spectating", "spectator-stop"),
  ];
  for (const control of controls) control.disabled = !authenticated;
  actions.append(...controls);
}

function playerActions(player: AdminPlayer, tracking: boolean): readonly (readonly [string, string])[] {
  return [
    [tracking ? "Spectating" : "Spectate", "spectate"],
    ["Spawn", "teleport-spawn"],
    ["Safe room", "teleport-safe"],
    ["Heal", "heal"],
    ["Kill", "kill"],
    ["Kill enemies", "kill-enemies"],
    [player.god ? "God off" : "God on", player.god ? "god-off" : "god-on"],
    [player.handicapped ? "Handicap off" : "Handicap on", player.handicapped ? "handicap-off" : "handicap-on"],
    [player.admin ? "Revoke Admin" : "Grant Admin", player.admin ? "admin-off" : "admin-on"],
  ];
}
