/** Blocking status overlay when disconnected or reconnecting after leaving the Title Screen. */
import type { ConnectionMode } from "../../net/worldClientHelpers.js";

const OVERLAY_CSS = `
position:fixed;inset:0;z-index:45;display:none;align-items:center;justify-content:center;
padding:20px;background:rgba(9,13,20,0.72);backdrop-filter:blur(6px);
font-family:system-ui,-apple-system,sans-serif;color:#f8fafc;
`;

const CARD_CSS = `
width:min(360px,100%);padding:22px 20px;border-radius:16px;text-align:center;
background:rgba(15,23,42,0.94);border:1px solid rgba(148,163,184,0.3);
box-shadow:0 18px 48px rgba(0,0,0,0.55);display:flex;flex-direction:column;gap:12px;align-items:center;
`;

const BTN_PRIMARY_CSS = `
padding:9px 16px;border-radius:10px;border:1px solid #f59e0b;background:rgba(180,83,9,0.88);
color:#fffbeb;font-size:13px;font-weight:700;cursor:pointer;
`;

const BTN_SEC_CSS = `
padding:9px 16px;border-radius:10px;border:1px solid rgba(148,163,184,0.3);background:rgba(30,41,59,0.9);
color:#e2e8f0;font-size:13px;font-weight:600;cursor:pointer;
`;

export interface ConnectionOverlayHooks {
  readonly onReconnectNow: () => void;
  readonly onReturnToTitle: () => void;
}

export class ConnectionStatusOverlay {
  private readonly root: HTMLDivElement;
  private readonly badge: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly subEl: HTMLDivElement;

  constructor(host: HTMLElement, hooks: ConnectionOverlayHooks) {
    this.root = document.createElement("div");
    this.root.style.cssText = OVERLAY_CSS;
    this.root.hidden = true;
    const card = document.createElement("div");
    card.style.cssText = CARD_CSS;
    this.badge = document.createElement("div");
    this.titleEl = document.createElement("div");
    this.titleEl.style.cssText = "font-size:18px;font-weight:800;letter-spacing:0.02em;";
    this.subEl = document.createElement("div");
    this.subEl.style.cssText = "font-size:13px;line-height:1.45;color:#cbd5e1;";
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px;";
    const retryBtn = makeOverlayBtn("Reconnect Now", BTN_PRIMARY_CSS, hooks.onReconnectNow);
    const titleBtn = makeOverlayBtn("Title Screen", BTN_SEC_CSS, hooks.onReturnToTitle);
    actions.append(retryBtn, titleBtn);
    card.append(this.badge, this.titleEl, this.subEl, actions);
    this.root.append(card);
    host.append(this.root);
  }

  sync(opts: { readonly visible: boolean; readonly mode: ConnectionMode; readonly attempt?: number | undefined }): void {
    this.root.hidden = !opts.visible;
    this.root.style.display = opts.visible ? "flex" : "none";
    if (!opts.visible) return;
    const attempt = opts.attempt ?? 0;
    const isInit = opts.mode === "connecting" && attempt === 0;
    this.badge.textContent = isInit ? "CONNECTING" : "DISCONNECTED";
    this.badge.style.cssText = resolveBadgeCss(isInit);
    this.titleEl.textContent = isInit ? "Connecting to Server..." : "Reconnecting to Server...";
    this.subEl.textContent = resolveSubCopy(isInit, attempt);
  }
}

function resolveBadgeCss(isInit: boolean): string {
  const tone = isInit
    ? "background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.45);"
    : "background:rgba(239,68,68,0.18);color:#fca5a5;border:1px solid rgba(248,113,113,0.45);";
  return `font-size:11px;font-weight:800;letter-spacing:0.12em;padding:4px 10px;border-radius:999px;${tone}`;
}

function resolveSubCopy(isInit: boolean, attempt: number): string {
  if (isInit) return "Syncing your hero and world state with the multiplayer server.";
  const note = attempt > 0 ? ` (attempt ${attempt + 1})` : "";
  return `Lost connection to the game server. Automatically reconnecting${note}...`;
}

function makeOverlayBtn(label: string, css: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.style.cssText = css;
  btn.addEventListener("click", onClick);
  return btn;
}
