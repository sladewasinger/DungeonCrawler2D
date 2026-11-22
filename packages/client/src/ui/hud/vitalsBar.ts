/** Compact HP bar, Stamina bar, and subtle spawn Sanctuary indicator above the bottom hotbar. */
import type { PlayerSnapshot } from "@dc2d/engine";
import { domNode } from "./slotRenderer.js";

function readVitals(player: PlayerSnapshot | undefined): {
  readonly hp: number; readonly maxHp: number; readonly stam: number; readonly maxStam: number; readonly safe: boolean;
} {
  if (!player) return { hp: 100, maxHp: 100, stam: 100, maxStam: 100, safe: true };
  return {
    hp: Math.max(0, Math.round(player.hp ?? 100)),
    maxHp: Math.max(1, Math.round(player.maxHp ?? 100)),
    stam: Math.max(0, Math.round(player.stamina ?? 100)),
    maxStam: Math.max(1, Math.round(player.maxStamina ?? 100)),
    safe: player.inSanctuary !== false,
  };
}

export class VitalsBar {
  readonly el: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLSpanElement;
  private readonly stamFill: HTMLDivElement;
  private readonly sanctuaryPill: HTMLSpanElement;
  private lastKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-vitals");
    const hpWrap = domNode("div", "ow-vbar ow-vbar-hp");
    this.hpFill = domNode("div", "ow-vbar-fill");
    this.hpText = domNode("span", "ow-vbar-text");
    hpWrap.append(this.hpFill, this.hpText);

    const stamWrap = domNode("div", "ow-vbar ow-vbar-stam");
    this.stamFill = domNode("div", "ow-vbar-fill");
    stamWrap.append(this.stamFill);

    this.sanctuaryPill = domNode("span", "ow-sanctuary-pill");
    this.sanctuaryPill.textContent = "Sanctuary";

    this.el.append(hpWrap, stamWrap, this.sanctuaryPill);
    host.append(this.el);
  }

  sync(player: PlayerSnapshot | undefined): void {
    const v = readVitals(player);
    const key = `${v.hp}/${v.maxHp}:${v.stam}/${v.maxStam}:${v.safe}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.hpFill.style.width = `${Math.min(100, (v.hp / v.maxHp) * 100)}%`;
    this.hpText.textContent = `${v.hp}/${v.maxHp}`;
    this.stamFill.style.width = `${Math.min(100, (v.stam / v.maxStam) * 100)}%`;
    this.sanctuaryPill.hidden = !v.safe;
  }
}
