/** Top-right Compass Rose badge displaying integer world (X, Y) coordinates cleanly. */
import { parseStaticSvg } from "../dom/staticSvg.js";

function compassSvg(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="flex-shrink:0">
    <circle cx="8" cy="8" r="6.5" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
    <polygon points="8,2.5 9.8,8 8,7 6.2,8" fill="#ef4444"/>
    <polygon points="8,13.5 9.8,8 8,9 6.2,8" fill="#cbd5e1"/>
    <circle cx="8" cy="8" r="1" fill="#fde047"/>
  </svg>`;
}

export class CompassBadge {
  readonly el: HTMLDivElement;
  private readonly textEl: HTMLSpanElement;
  private lastKey = "";

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "ow-pill ow-compass-pill";
    this.el.title = "World Coordinates (X, Y) — Spawn Campfire is near (2, -2)";
    this.textEl = document.createElement("span");
    this.textEl.className = "ow-compass-coords";
    this.textEl.textContent = "0, 0";
    this.el.append(parseStaticSvg(compassSvg()), this.textEl);
  }

  sync(x: number, y: number, biomeHint?: string): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const key = `${ix},${iy}:${biomeHint ?? ""}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.textEl.textContent = biomeHint ? `${ix}, ${iy} · ${biomeHint}` : `${ix}, ${iy}`;
  }
}
