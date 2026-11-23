/** Centered HP bar + Sanctuary & Stealth visibility meter, paired with vertical left-edge Stamina bar. */
import type { PlayerSnapshot } from "@dc2d/engine";
import { domNode } from "./slotRenderer.js";

function readVitals(player: PlayerSnapshot | undefined) {
  if (!player) return { hp: 100, maxHp: 100, stam: 100, maxStam: 100, safe: true, stealth: false, vis: 1, cover: false };
  return {
    hp: Math.max(0, Math.round(player.hp ?? 100)),
    maxHp: Math.max(1, Math.round(player.maxHp ?? 100)),
    stam: Math.max(0, Math.round(player.stamina ?? 100)),
    maxStam: Math.max(1, Math.round(player.maxStamina ?? 100)),
    safe: player.inSanctuary !== false,
    stealth: Boolean(player.crouching || player.inCover),
    vis: player.stealthVis ?? 0.8,
    cover: Boolean(player.inCover),
  };
}

const staminaTierForPct = (pct: number): "high" | "mid" | "low" => (pct >= 55 ? "high" : pct >= 25 ? "mid" : "low");

function stealthTier(vis: number, cover: boolean): { readonly tier: string; readonly label: string } {
  if (vis <= 0.36) return { tier: "hidden", label: cover ? "COVERED" : "HIDDEN" };
  if (vis <= 0.66) return { tier: "shaded", label: "SHADED" };
  return { tier: "exposed", label: "EXPOSED" };
}

export class VitalsBar {
  readonly el: HTMLDivElement;
  readonly staminaRail: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLSpanElement;
  private readonly stamFill: HTMLDivElement;
  private readonly sanctuaryPill: HTMLSpanElement;
  private readonly stealthPill: HTMLSpanElement;
  private lastKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-vitals");
    const hpWrap = domNode("div", "ow-vbar ow-vbar-hp");
    this.hpFill = domNode("div", "ow-vbar-fill");
    this.hpText = domNode("span", "ow-vbar-text");
    hpWrap.append(this.hpFill, this.hpText);

    this.stealthPill = domNode("span", "ow-stealth-pill");
    this.stealthPill.hidden = true;
    this.sanctuaryPill = domNode("span", "ow-sanctuary-pill");
    this.sanctuaryPill.textContent = "Sanctuary";
    this.el.append(hpWrap, this.stealthPill, this.sanctuaryPill);

    this.staminaRail = domNode("div", "ow-stamina-rail");
    this.staminaRail.setAttribute("aria-label", "Stamina");
    this.stamFill = domNode("div", "ow-stamina-fill");
    this.stamFill.dataset.tier = "high";
    this.staminaRail.append(this.stamFill);
    host.append(this.el, this.staminaRail);
  }

  sync(player: PlayerSnapshot | undefined): void {
    const v = readVitals(player);
    const visPct = Math.round(v.vis * 100);
    const key = `${v.hp}/${v.maxHp}:${v.stam}/${v.maxStam}:${v.safe}:${v.stealth}:${v.cover}:${visPct}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.hpFill.style.width = `${Math.min(100, (v.hp / v.maxHp) * 100)}%`;
    this.hpText.textContent = `${v.hp}/${v.maxHp}`;
    const stamPct = Math.min(100, Math.max(0, (v.stam / v.maxStam) * 100));
    this.stamFill.style.height = `${stamPct}%`;
    this.stamFill.dataset.tier = staminaTierForPct(stamPct);
    this.sanctuaryPill.hidden = !v.safe;
    this.stealthPill.hidden = !v.stealth;
    if (v.stealth) {
      const s = stealthTier(v.vis, v.cover);
      this.stealthPill.dataset.tier = s.tier;
      this.stealthPill.textContent = `${s.label} ${visPct}%`;
    }
  }
}