/** Renders distinct 28x28 SVG buff/status badges with radial countdown rings and accessible tooltips. */
import { SURVIVAL_BUFF_TUNING } from "@dc2d/engine";
import { parseStaticSvg } from "../../dom/staticSvg.js";
import { domNode } from "../slotRenderer.js";
import { BUFF_SVG_ICONS, type BuffIconId } from "./buffIcons.js";
import { ensureBuffTrayStyles } from "./buffStyles.js";

export interface BuffEntry {
  readonly id: BuffIconId;
  readonly label: string;
  readonly detail: string;
  readonly sec: number;
  readonly maxSec: number;
  readonly color: string;
  readonly sticky?: boolean | undefined;
}

interface CachedBadge {
  readonly btn: HTMLButtonElement;
  readonly circle: SVGCircleElement;
  readonly secEl: HTMLSpanElement;
  detail: string;
  lastKey: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const RING_CIRC = 2 * Math.PI * 11;

export interface BuffSourceData {
  readonly wellFedSec: number;
  readonly invigoratedSec: number;
  readonly restedSec: number;
  readonly hotSec: number;
  readonly shrineKind: string;
  readonly shrineSec: number;
  readonly poisonSec: number;
  readonly poisonLocked: boolean;
  readonly stuckText: string;
  readonly burnSec: number;
  readonly god: boolean;
}

function appendShrineBuff(v: BuffSourceData, out: BuffEntry[]): void {
  if (v.shrineSec <= 0) return;
  if (v.shrineKind === "swiftness" || v.shrineKind === "vigor" || v.shrineKind === "shadow") {
    out.push({ id: v.shrineKind, label: v.shrineKind.toUpperCase(), detail: `Shrine: ${v.shrineKind} (${v.shrineSec}s)`, sec: v.shrineSec, maxSec: 180, color: "#38bdf8" });
  }
}

function appendDebuffAndGodEntries(v: BuffSourceData, out: BuffEntry[]): void {
  if (v.poisonSec > 0 || v.poisonLocked) {
    out.push({ id: "poison", label: "Poisoned", detail: v.poisonLocked ? "Poisoned (Webbed)" : `Poisoned (${v.poisonSec}s)`, sec: v.poisonSec, maxSec: 12, color: "#4ade80", sticky: v.poisonLocked });
  }
  if (v.stuckText) out.push({ id: "web", label: v.stuckText, detail: v.stuckText, sec: 0, maxSec: 1, color: "#cbd5e1", sticky: true });
  if (v.burnSec > 0) out.push({ id: "burn", label: "Burning", detail: `Burning (${v.burnSec}s)`, sec: v.burnSec, maxSec: 6, color: "#fb923c" });
  if (v.god) out.push({ id: "god", label: "GOD", detail: "God Mode Active", sec: 0, maxSec: 1, color: "#fde047", sticky: true });
}

function buildBuffEntries(v: BuffSourceData): readonly BuffEntry[] {
  const out: BuffEntry[] = [];
  if (v.wellFedSec > 0) out.push({ id: "well-fed", label: "Well-Fed", detail: `Well-Fed: +15 Max HP & regen (${v.wellFedSec}s)`, sec: v.wellFedSec, maxSec: 240, color: "#fbbf24" });
  if (v.invigoratedSec > 0) out.push({ id: "invigorated", label: "Invigorated", detail: `Invigorated: +16 Stam/s & 0.5x delay (${v.invigoratedSec}s)`, sec: v.invigoratedSec, maxSec: SURVIVAL_BUFF_TUNING.invigoratedDurationSec, color: "#2dd4bf" });
  if (v.restedSec > 0) out.push({ id: "rested", label: "Rested", detail: `Rested: +0.8 HP/s & +10 Stam/s (${v.restedSec}s)`, sec: v.restedSec, maxSec: SURVIVAL_BUFF_TUNING.restedDurationSec, color: "#38bdf8" });
  if (v.hotSec > 0) out.push({ id: "salve", label: "Herbal Salve", detail: `Herbal Salve HoT: +55 HP (${v.hotSec}s)`, sec: v.hotSec, maxSec: SURVIVAL_BUFF_TUNING.salveHotDurationSec, color: "#4ade80" });
  appendShrineBuff(v, out);
  appendDebuffAndGodEntries(v, out);
  return out;
}

function makeCountdownRing(): { readonly svg: SVGSVGElement; readonly circle: SVGCircleElement } {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "ow-buff-ring");
  svg.setAttribute("viewBox", "0 0 28 28");
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", "14"); circle.setAttribute("cy", "14"); circle.setAttribute("r", "11");
  circle.setAttribute("fill", "none"); circle.setAttribute("stroke-width", "2.2");
  circle.setAttribute("stroke-dasharray", RING_CIRC.toFixed(1));
  svg.appendChild(circle);
  return { svg, circle };
}

function updateBadgeView(badge: CachedBadge, entry: BuffEntry): void {
  const key = `${entry.sec}|${entry.color}|${entry.detail}`;
  if (key === badge.lastKey) return;
  badge.lastKey = key;
  badge.detail = entry.detail;
  badge.btn.setAttribute("aria-label", entry.detail);
  badge.btn.title = entry.detail;
  const ratio = entry.sticky ? 1 : entry.sec / Math.max(1, entry.maxSec);
  badge.circle.setAttribute("stroke", entry.color);
  badge.circle.setAttribute("stroke-dashoffset", (RING_CIRC * (1 - Math.max(0, Math.min(1, ratio)))).toFixed(1));
  badge.secEl.textContent = entry.sec > 0 ? `${entry.sec}s` : "";
}

export class BuffTray {
  readonly el: HTMLDivElement;
  private readonly tooltip: HTMLDivElement;
  private readonly badges = new Map<BuffIconId, CachedBadge>();
  private lastOrderKey = "";
  private pinnedId: BuffIconId | null = null;

  constructor(host: HTMLElement) {
    ensureBuffTrayStyles();
    this.el = domNode("div", "ow-buff-tray");
    this.el.hidden = true;
    this.tooltip = domNode("div", "ow-buff-tooltip");
    this.tooltip.hidden = true;
    host.append(this.tooltip);
  }

  sync(v: BuffSourceData): void {
    const entries = buildBuffEntries(v);
    this.el.hidden = entries.length === 0;
    const orderKey = entries.map((e) => e.id).join(",");
    if (orderKey !== this.lastOrderKey) {
      this.lastOrderKey = orderKey;
      this.reconcileOrder(entries);
    }
    for (const entry of entries) {
      const badge = this.badges.get(entry.id);
      if (badge) updateBadgeView(badge, entry);
    }
    this.syncPinnedTooltip();
  }

  private reconcileOrder(entries: readonly BuffEntry[]): void {
    const active = new Set(entries.map((e) => e.id));
    for (const id of this.badges.keys()) {
      if (!active.has(id)) this.badges.delete(id);
    }
    for (const entry of entries) {
      if (!this.badges.has(entry.id)) this.badges.set(entry.id, this.createBadge(entry.id));
    }
    this.el.replaceChildren(...entries.map((e) => this.badges.get(e.id)!.btn));
  }

  private syncPinnedTooltip(): void {
    if (!this.pinnedId) return;
    const active = this.badges.get(this.pinnedId);
    if (active) { this.showTooltip(active.detail); return; }
    this.pinnedId = null;
    this.tooltip.hidden = true;
  }

  private createBadge(id: BuffIconId): CachedBadge {
    const btn = domNode("button", "ow-buff-badge");
    btn.type = "button";
    btn.dataset.buff = id;
    const svg = parseStaticSvg(BUFF_SVG_ICONS[id]);
    svg.setAttribute("class", "ow-buff-svg");
    const ring = makeCountdownRing();
    const secEl = domNode("span", "ow-buff-sec");
    btn.append(ring.svg, svg, secEl);
    const badge: CachedBadge = { btn, circle: ring.circle, secEl, detail: "", lastKey: "" };
    this.bindBadgeEvents(badge, id);
    return badge;
  }

  private bindBadgeEvents(badge: CachedBadge, id: BuffIconId): void {
    badge.btn.addEventListener("pointerenter", () => this.showTooltip(badge.detail));
    badge.btn.addEventListener("pointerleave", () => { if (!this.pinnedId) this.tooltip.hidden = true; });
    badge.btn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.pinnedId = this.pinnedId === id ? null : id;
      if (this.pinnedId) this.showTooltip(badge.detail);
      else this.tooltip.hidden = true;
    });
  }

  private showTooltip(text: string): void {
    this.tooltip.textContent = text;
    this.tooltip.hidden = false;
  }
}
