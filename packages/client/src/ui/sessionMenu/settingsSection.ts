export function createSettingsSection(
  title: string,
  accent: string,
  controls: HTMLElement[],
): HTMLFieldSetElement {
  const section = document.createElement("fieldset");
  section.style.cssText =
    `display:grid;gap:10px;min-width:0;margin:0;padding:12px 12px 14px;` +
    `border:1px solid ${accent};border-radius:4px;background:rgba(30,31,48,.55)`;
  const legend = document.createElement("legend");
  legend.textContent = title;
  legend.style.cssText =
    `padding:0 7px;color:${accent};font-size:13px;font-weight:bold;` +
    "letter-spacing:.02em";
  section.append(legend, ...controls);
  return section;
}
