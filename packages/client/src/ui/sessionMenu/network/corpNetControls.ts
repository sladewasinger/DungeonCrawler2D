import type { Connection } from "../../../net/connection/connection.js";

/** Creates the deliberately explicit opt-in for unreliable inspected networks. */
export function createExperimentalCorpNetControls(
  connection: Connection,
): HTMLElement[] {
  const toggle = document.createElement("label");
  toggle.className = "hud-session__toggle";
  const label = document.createElement("span");
  label.textContent = "Experimental CorpNet smoothing";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = connection.experimentalCorpNetEnabled;
  checkbox.setAttribute("aria-label", label.textContent);
  checkbox.title = "Adds a bounded jitter buffer and stale-snapshot recovery for unstable corporate networks.";
  checkbox.addEventListener("change", () => {
    connection.setExperimentalCorpNetEnabled(checkbox.checked);
  });
  toggle.append(label, checkbox);

  const description = document.createElement("p");
  description.className = "hud-session__hint";
  description.textContent = "Slower but steadier on inspected VPN or proxy links. Disabled by default.";
  return [toggle, description];
}
