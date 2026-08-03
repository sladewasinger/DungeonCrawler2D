import type { ActionDefinition } from "../spectator/actions/adminPlayerActions.js";
import { configureToggleSwitch } from "../../ui/foundation/toggleSwitch.js";
import { actionButton } from "../portal/adminPagePrimitives.js";

export const FREE_PAN_ACTION: ActionDefinition = ["Free pan", "map-free-camera", false];

export function configureFreePanToggle(
  control: HTMLButtonElement,
  pressed: boolean,
): void {
  configureToggleSwitch(control, FREE_PAN_ACTION[0], pressed);
}

export function createFreePanControl(): HTMLButtonElement {
  const [label, action, pressed = false] = FREE_PAN_ACTION;
  const control = actionButton(label, action);
  configureFreePanToggle(control, pressed);
  return control;
}

export function setFreePanToggle(root: HTMLElement, enabled: boolean): void {
  const control = root.querySelector<HTMLButtonElement>(
    '[data-admin-action="map-free-camera"]',
  );
  if (control) configureFreePanToggle(control, enabled);
}
