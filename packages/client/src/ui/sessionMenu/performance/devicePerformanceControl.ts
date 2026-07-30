import {
  loadDevicePresentationSettings,
  saveDevicePresentationMode,
} from "../../../presentation/devicePresentationSettings.js";

const CONTROL_LABEL = "Performance profile";

export function createDevicePerformanceControl(): HTMLLabelElement {
  const row = document.createElement("label");
  row.className = "hud-session__motion";
  const label = document.createElement("span");
  label.textContent = CONTROL_LABEL;
  const select = document.createElement("select");
  select.className = "hud-session__select";
  select.setAttribute("aria-label", CONTROL_LABEL);
  addDevicePerformanceOptions(select);
  select.value = loadDevicePresentationSettings().mode;
  select.title = "Auto preserves phone detection; Constrained forces the lower-resource profile.";
  select.addEventListener("change", () => {
    saveDevicePresentationMode(select.value === "constrained" ? "constrained" : "auto");
    reloadClientForPresentationProfile();
  });
  row.append(label, select);
  return row;
}

function addDevicePerformanceOptions(select: HTMLSelectElement): void {
  for (const [value, label] of [
    ["auto", "Auto (follow device)"],
    ["constrained", "Constrained (lower resource use)"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function reloadClientForPresentationProfile(): void {
  if (typeof globalThis.location === "undefined") return;
  globalThis.location.reload();
}
