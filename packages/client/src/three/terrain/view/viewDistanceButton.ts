/** Owns the settings-menu control used to switch deterministic terrain view ranges. */
import { nextViewDistance, type ViewDistance } from "./viewDistance.js";
import { createHudButton } from "../../../ui/hud/styles/HudStyles.js";

export const createViewDistanceButton = (getDistance: () => ViewDistance, setDistance: (distance: ViewDistance) => void): HTMLButtonElement => {
  const button = createHudButton("", () => {
    setDistance(nextViewDistance(getDistance()));
    updateLabel();
  });
  Object.assign(button.style, {
    width: "100%",
    marginTop: "8px",
    padding: "7px",
    borderColor: "#757a93",
    background: "#292b40",
    fontSize: "12px",
  });
  const updateLabel = () => { button.textContent = `View Distance: ${getDistance()}`; };
  updateLabel();
  return button;
};
