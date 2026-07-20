// Tiny shared DOM helpers for the paint panel's button-based UI.
export function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    "background:#1a1a24;color:#d9d9e4;border:1px solid #494956;border-radius:4px;padding:4px 8px;cursor:pointer;font:12px monospace";
  b.addEventListener("click", onClick);
  return b;
}

/** Clears every sibling button's outline in `bar` and highlights `target` as active. */
export function selectButton(bar: HTMLElement, target: HTMLButtonElement): void {
  for (const el of bar.querySelectorAll("button")) (el as HTMLButtonElement).style.outline = "";
  target.style.outline = "2px solid #ffd23d";
}

/** A small dim caption heading a palette section (EFFECTS/SPAWN/LIGHTING/…). */
export function sectionLabel(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText = "font:11px monospace;color:#8f8fa3;margin-top:6px";
  return el;
}
