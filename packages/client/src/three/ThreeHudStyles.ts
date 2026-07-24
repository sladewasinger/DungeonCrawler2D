/** Centralizes the HTML HUD's 2D-inspired visual language without changing geometry. */
export const HUD_GOLD = "#ffd54c";
export const HUD_TEXT = "#f2f0eb";
export const HUD_MUTED = "#aaaec8";
export const HUD_PANEL =
  "width:100%;height:100%;box-sizing:border-box;padding:8px;" +
  "background:rgba(17,18,29,.78);border:1px solid rgba(86,91,116,.82);" +
  "box-shadow:0 8px 22px rgba(0,0,0,.28);overflow:hidden";

export const createHudTitle = (text: string): HTMLDivElement => {
  const title = document.createElement("div");
  title.textContent = text;
  title.style.cssText =
    `color:${HUD_MUTED};font-size:10px;letter-spacing:.08em;` +
    "text-transform:uppercase;margin-bottom:7px";
  return title;
};

export const createHudButton = (
  label: string,
  action: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText =
    `border:1px solid #555a75;background:#1b1c2c;color:${HUD_TEXT};` +
    "padding:4px 6px;font:10px monospace;pointer-events:auto";
  button.addEventListener("click", action);
  return button;
};
