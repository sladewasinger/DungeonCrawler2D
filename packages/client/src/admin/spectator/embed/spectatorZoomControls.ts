export interface SpectatorZoomControlsInput {
  readonly zoom: (direction: "in" | "out") => void;
  readonly reset: () => void;
}

export function spectatorZoomControls(input: SpectatorZoomControlsInput): HTMLElement {
  const controls = document.createElement("div");
  controls.dataset.adminSpectatorZoomControls = "";
  controls.append(
    zoomButton("−", "Zoom live spectator out", () => input.zoom("out")),
    zoomButton("100%", "Reset live spectator zoom to 100%", input.reset),
    zoomButton("+", "Zoom live spectator in", () => input.zoom("in")),
  );
  return controls;
}

function zoomButton(
  label: string,
  accessibleLabel: string,
  onClick: () => void,
): HTMLButtonElement {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.title = accessibleLabel;
  control.setAttribute("aria-label", accessibleLabel);
  control.addEventListener("click", onClick);
  return control;
}
