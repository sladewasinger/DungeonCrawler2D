/** Turns an ordinary admin action button into an explicit accessible on/off switch. */
export function configureAdminToggle(
  control: HTMLButtonElement,
  label: string,
  pressed: boolean,
): void {
  const name = document.createElement("span");
  name.textContent = label;
  name.dataset.adminToggleLabel = "";
  const state = document.createElement("strong");
  state.textContent = pressed ? "ON" : "OFF";
  state.dataset.adminToggleState = "";
  const track = document.createElement("span");
  track.dataset.adminToggleTrack = "";
  track.setAttribute("aria-hidden", "true");
  const knob = document.createElement("span");
  knob.dataset.adminToggleKnob = "";
  track.append(knob);
  control.replaceChildren(name, state, track);
  control.dataset.adminToggle = "";
  control.setAttribute("role", "switch");
  control.setAttribute("aria-checked", String(pressed));
  control.setAttribute("aria-pressed", String(pressed));
}
