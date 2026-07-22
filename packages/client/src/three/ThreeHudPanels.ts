/** Shared DOM factories for first-person HUD panels. */
export const createHudPanelTitle = (text: string) => {
  const element = document.createElement("div");
  element.textContent = text;
  element.style.cssText = "color:#aaaec8;font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px";
  return element;
};

export const createHudSlots = () => {
  const grid = document.createElement("div");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(9,minmax(30px,1fr));gap:4px";
  const labels = ["sword", "bandage", "flask", "torch", "hammer", "", "", "", ""];
  labels.forEach((label, index) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.textContent = label ? String(index + 1) + "\n" + label : String(index + 1);
    slot.style.cssText = "min-height:42px;padding:2px;border:1px solid #555a75;background:#1b1c2c;color:#e6e5ef;font:10px monospace;white-space:pre-line";
    slot.addEventListener("click", () => selectHudSlot(grid, slot));
    grid.append(slot);
  });
  return grid;
};

const selectHudSlot = (grid: HTMLDivElement, slot: HTMLButtonElement) => {
  for (const sibling of grid.children) (sibling as HTMLElement).style.outline = "none";
  slot.style.outline = "2px solid #ffd54c";
};
