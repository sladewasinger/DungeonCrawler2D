export function title(label: string): HTMLHeadingElement {
  const heading = document.createElement("h1");
  heading.textContent = label;
  heading.style.cssText = "width:100%;margin:0 0 4px;font-size:20px";
  return heading;
}

/** Creates a semantic control section with the visual hierarchy used by game settings. */
export function controlFieldset(label: string): HTMLFieldSetElement {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = label;
  fieldset.append(legend);
  return fieldset;
}

export function text(value: string): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = value;
  paragraph.style.cssText = "margin:0;color:#aeb8ca";
  return paragraph;
}

export function button(label: string, id: string): HTMLButtonElement {
  const control = document.createElement("button");
  control.textContent = label;
  control.id = id;
  control.type = "button";
  control.style.cssText = "padding:7px 10px;background:#2b3446;color:#f4f7fb;border:1px solid #56657d;border-radius:4px;cursor:pointer";
  return control;
}

export function actionButton(label: string, action: string): HTMLButtonElement {
  const control = button(label, `admin-${action}`);
  control.dataset.adminAction = action;
  return control;
}

export function cell(value: string): HTMLTableCellElement {
  const tableCell = document.createElement("td");
  tableCell.textContent = value;
  tableCell.style.cssText = "padding:8px;border-bottom:1px solid #2b3446;vertical-align:top";
  return tableCell;
}
