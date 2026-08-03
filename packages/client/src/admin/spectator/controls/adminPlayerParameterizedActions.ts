import type { AdminPlayer } from "@dc2d/engine";
import { actionButton, controlFieldset } from "../../portal/adminPagePrimitives.js";

export interface AdminParameterizedActionsInput {
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
}

export function positionActionGroup(input: AdminParameterizedActionsInput): HTMLElement {
  const group = actionGroup("Position");
  group.append(
    playerAction("Send to spawn", "teleport-spawn", input),
    playerAction("Send to safe room", "teleport-safe", input),
    coordinateControls(input),
  );
  return group;
}

export function combatActionGroup(input: AdminParameterizedActionsInput): HTMLElement {
  const group = actionGroup("Health & combat");
  group.append(
    playerAction("Heal", "heal", input),
    playerAction("Kill", "kill", input),
    radiusControls(input),
  );
  return group;
}

function coordinateControls(input: AdminParameterizedActionsInput): HTMLElement {
  const controls = document.createElement("div");
  controls.dataset.adminCoordinateControls = "";
  controls.append(
    numberField({ label: "X", dataKey: "adminTeleportX", value: input.player.x, step: "any" }),
    numberField({ label: "Y", dataKey: "adminTeleportY", value: input.player.y, step: "any" }),
    playerAction("Teleport", "teleport-coordinates", input),
  );
  return controls;
}

function radiusControls(input: AdminParameterizedActionsInput): HTMLElement {
  const controls = document.createElement("div");
  controls.dataset.adminRadiusControls = "";
  controls.append(
    numberField({
      label: "Radius",
      dataKey: "adminEnemyRadius",
      value: 8,
      step: "1",
      bounds: { min: 1, max: 64 },
    }),
    playerAction("Kill nearby enemies", "kill-enemies", input),
  );
  return controls;
}

interface NumberFieldInput {
  readonly label: string;
  readonly dataKey: "adminTeleportX" | "adminTeleportY" | "adminEnemyRadius";
  readonly value: number;
  readonly step: string;
  readonly bounds?: { readonly min: number; readonly max: number };
}

function numberField(field: NumberFieldInput): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = field.label;
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(field.value);
  input.step = field.step;
  if (field.bounds) {
    input.min = String(field.bounds.min);
    input.max = String(field.bounds.max);
  }
  input.dataset[field.dataKey] = "";
  wrapper.append(input);
  return wrapper;
}

function actionGroup(label: string): HTMLElement {
  const group = controlFieldset(label);
  group.dataset.adminActionGroup = "";
  return group;
}

function playerAction(
  label: string,
  action: string,
  input: AdminParameterizedActionsInput,
): HTMLButtonElement {
  const control = actionButton(label, action);
  control.dataset.playerId = input.player.playerId;
  control.disabled = !input.authenticated;
  return control;
}
