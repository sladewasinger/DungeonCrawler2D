/** Owns the settings-menu control used to switch deterministic terrain view ranges. */
import { nextViewDistance, type ViewDistance } from "./viewDistance.js";

export const createViewDistanceButton = (getDistance: () => ViewDistance, setDistance: (distance: ViewDistance) => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.style.cssText = "width:100%;margin-top:8px;padding:7px;border:1px solid #757a93;background:#292b40;color:#f2f0eb;font:12px monospace";
  const updateLabel = () => { button.textContent = `View Distance: ${getDistance()}`; };
  updateLabel();
  button.addEventListener("click", () => {
    setDistance(nextViewDistance(getDistance()));
    updateLabel();
  });
  return button;
};
