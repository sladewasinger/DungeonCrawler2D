export function createSettingsSection(
  title: string,
  accent: string,
  controls: HTMLElement[],
): HTMLFieldSetElement {
  const section = document.createElement("fieldset");
  section.className = "hud-session__settings-section";
  section.style.setProperty("--hud-session-accent", accent);
  const legend = document.createElement("legend");
  legend.textContent = title;
  legend.className = "hud-session__settings-legend";
  section.append(legend, ...controls);
  return section;
}
