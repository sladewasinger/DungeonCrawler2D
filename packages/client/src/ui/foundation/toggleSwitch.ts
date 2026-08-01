export interface ToggleSwitchPresentation {
  readonly label: string;
  readonly state: "ON" | "OFF";
  readonly checked: string;
}

export function toggleSwitchPresentation(
  label: string,
  checked: boolean,
): ToggleSwitchPresentation {
  return {
    label,
    state: checked ? "ON" : "OFF",
    checked: String(checked),
  };
}

/** Configures a button as the shared, accessible binary switch control. */
export function configureToggleSwitch(
  control: HTMLButtonElement,
  label: string,
  checked: boolean,
): void {
  const presentation = toggleSwitchPresentation(label, checked);
  control.replaceChildren(
    switchPart("span", "toggle-switch__label", presentation.label),
    switchPart("strong", "toggle-switch__state", presentation.state),
    toggleTrack(),
  );
  control.classList.add("toggle-switch");
  control.setAttribute("role", "switch");
  control.setAttribute("aria-checked", presentation.checked);
  control.removeAttribute("aria-pressed");
}

function toggleTrack(): HTMLSpanElement {
  const track = switchPart("span", "toggle-switch__track");
  track.setAttribute("aria-hidden", "true");
  track.append(switchPart("span", "toggle-switch__knob"));
  return track;
}

function switchPart<K extends "span" | "strong">(
  kind: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(kind);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
