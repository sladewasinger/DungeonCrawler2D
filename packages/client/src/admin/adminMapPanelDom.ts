import { controlFieldset, title } from "./portal/adminPagePrimitives.js";

export function mapPanelSection(label: string): HTMLElement {
  const section = document.createElement("section");
  section.append(title(label));
  return section;
}

export function mapLevelSelect(label: string, values: readonly string[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.title = label;
  select.dataset.adminMapLevel = "";
  for (const value of values) select.append(mapOption(value));
  return select;
}

export function mapCanvasFieldset(map: HTMLCanvasElement): HTMLFieldSetElement {
  const fieldset = controlFieldset("Map");
  fieldset.dataset.adminMapCanvasSection = "";
  fieldset.append(map);
  return fieldset;
}

function mapOption(value: string): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  return option;
}
