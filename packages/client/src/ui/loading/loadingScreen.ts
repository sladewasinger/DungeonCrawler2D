/** Pre-title boot loading overlay displaying live asset preload and texture bake progress. */
import { domNode } from "../hud/slotRenderer.js";
import { ensureLoadingStyles } from "./loadingStyles.js";

const TAG_DIV = "div";
const TAG_SPAN = "span";
const FADE_MS = 220;

interface LoadingDomRefs {
  readonly root: HTMLDivElement;
  readonly fillEl: HTMLDivElement;
  readonly statusEl: HTMLSpanElement;
  readonly pctEl: HTMLSpanElement;
}

function adoptExistingLoadingDom(): LoadingDomRefs | null {
  const root = document.getElementById("ow-boot-loading") as HTMLDivElement | null;
  if (!root?.querySelector) return null;
  const fillEl = root.querySelector(".ow-loading-fill") as HTMLDivElement | null;
  const statusEl = root.querySelector(".ow-loading-status") as HTMLSpanElement | null;
  const pctEl = root.querySelector(".ow-loading-pct") as HTMLSpanElement | null;
  if (!fillEl || !statusEl || !pctEl) return null;
  return { root, fillEl, statusEl, pctEl };
}

export class LoadingScreen {
  private readonly root: HTMLDivElement;
  private readonly fillEl: HTMLDivElement;
  private readonly statusEl: HTMLSpanElement;
  private readonly pctEl: HTMLSpanElement;
  private progress = 0;
  private dismissed = false;

  constructor(host: HTMLElement) {
    ensureLoadingStyles();
    const existing = adoptExistingLoadingDom();
    if (existing) {
      this.root = existing.root;
      this.fillEl = existing.fillEl;
      this.statusEl = existing.statusEl;
      this.pctEl = existing.pctEl;
      return;
    }
    this.root = domNode(TAG_DIV, "ow-loading-backdrop");
    this.fillEl = domNode(TAG_DIV, "ow-loading-fill");
    this.statusEl = domNode(TAG_SPAN, "ow-loading-status");
    this.pctEl = domNode(TAG_SPAN, "ow-loading-pct");
    this.statusEl.textContent = "Preparing assets...";
    this.pctEl.textContent = "0%";
    this.root.append(this.buildCard());
    host.append(this.root);
  }

  private buildCard(): HTMLDivElement {
    const card = domNode(TAG_DIV, "ow-loading-card");
    const title = domNode("h1", "ow-loading-title");
    title.textContent = "Dungeon Crawler 2D";
    const sub = domNode("p", "ow-loading-sub");
    sub.textContent = "Verdant Overworld · Warming Realm";
    const track = domNode(TAG_DIV, "ow-loading-track");
    track.append(this.fillEl);
    const meta = domNode(TAG_DIV, "ow-loading-meta");
    meta.append(this.statusEl, this.pctEl);
    card.append(title, sub, track, meta);
    return card;
  }

  setProgress(fraction: number, statusText: string): void {
    if (this.dismissed) return;
    this.fillEl.classList?.remove?.("ow-loading-indeterminate");
    const clamped = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
    this.progress = Math.max(this.progress, clamped);
    const pct = Math.round(this.progress * 100);
    this.fillEl.style.width = `${pct}%`;
    this.pctEl.textContent = `${pct}%`;
    this.statusEl.textContent = statusText;
  }

  dismiss(): Promise<void> {
    if (this.dismissed) return Promise.resolve();
    this.dismissed = true;
    this.root.classList.add("ow-loading-done");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.root.remove();
        resolve();
      }, FADE_MS);
    });
  }
}
