import { PREVIEW_TERRITORY_CATALOG } from "./territoryCatalog.js";
import type { ControlFieldElement, ControlFieldKey } from "./generationPreviewControlDom.js";

export function territoryField(
  selectedIds: readonly string[],
  fields: Map<ControlFieldKey, ControlFieldElement>,
): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.dataset.adminGenerationControl = "territoryRoster";
  wrapper.textContent = "Territory catalog";
  const element = document.createElement("select");
  element.multiple = true;
  element.size = Math.min(6, PREVIEW_TERRITORY_CATALOG.length);
  element.dataset.generationControl = "territoryRoster";
  for (const territory of PREVIEW_TERRITORY_CATALOG) element.append(territoryOption(territory, selectedIds));
  fields.set("territoryRoster", element);
  const help = document.createElement("small");
  help.textContent = "Choose catalog IDs; descriptions explain the authored layout/material identity.";
  wrapper.append(element, help);
  return wrapper;
}

function territoryOption(
  territory: (typeof PREVIEW_TERRITORY_CATALOG)[number],
  selectedIds: readonly string[],
): HTMLOptionElement {
  const choice = document.createElement("option");
  choice.value = territory.id;
  choice.textContent = `${territory.name} — ${territory.description}`;
  choice.selected = selectedIds.includes(territory.id);
  return choice;
}
