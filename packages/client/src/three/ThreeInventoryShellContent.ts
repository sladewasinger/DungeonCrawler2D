export interface InventoryContent {
  toolbar: HTMLDivElement;
  body: HTMLDivElement;
  list: HTMLDivElement;
}

export const createInventoryContent = (
  tabs: HTMLDivElement,
  folders: HTMLElement,
  search: HTMLInputElement,
): InventoryContent => {
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,260px);align-items:center;gap:10px";
  toolbar.append(tabs, search);
  const list = document.createElement("div");
  list.style.cssText = "min-height:0;overflow-y:auto;display:grid;align-content:start;gap:6px;padding-right:4px;scrollbar-color:#555a75 #171827";
  const body = document.createElement("div");
  body.style.cssText = "min-height:0;display:grid;grid-template-columns:minmax(110px,170px) minmax(0,1fr);gap:10px";
  body.append(folders, list);
  return { toolbar, body, list };
};
