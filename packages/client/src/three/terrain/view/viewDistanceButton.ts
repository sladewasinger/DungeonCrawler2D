/** Owns the settings-menu control used to switch deterministic terrain view ranges. */
import { nextViewDistance, type ViewDistance } from "./viewDistance.js";
import { createHudButton } from "../../../ui/hud/styles/HudStyles.js";

export const createViewDistanceButton = (getDistance: () => ViewDistance, setDistance: (distance: ViewDistance) => void): HTMLButtonElement => {
  const button = createHudButton("", () => {
    setDistance(nextViewDistance(getDistance()));
    updateLabel();
  });
  button.classList.add("hud-settings__button", "hud-settings__view-distance");
  const updateLabel = () => { button.textContent = `View Distance: ${getDistance()}`; };
  updateLabel();
  return button;
};
