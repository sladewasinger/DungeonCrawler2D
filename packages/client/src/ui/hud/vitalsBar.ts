/** Centered HP bar + Sanctuary & diegetic Stealth Eye + Light Gem meter paired with vertical Stamina rail. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { domNode } from "./slotRenderer.js";

const ACTIVE_ALERT_STATES = new Set(["chase", "flank", "charge", "alert"]);

function isSuspiciousEntity(e: WorldEntitySnapshot): boolean {
  return (e.suspicion ?? 0) >= 0.35 || e.aiState === "investigate";
}

function entityThreatRank(player: PlayerSnapshot, e: WorldEntitySnapshot): number {
  if (e.corpse || e.hp <= 0) return 0;
  if (Math.hypot(e.x - player.x, e.y - player.y) > 14) return 0;
  if (ACTIVE_ALERT_STATES.has(e.aiState ?? "")) return 2;
  return isSuspiciousEntity(e) ? 1 : 0;
}

function resolveThreatLevel(player: PlayerSnapshot | undefined, entities?: readonly WorldEntitySnapshot[]): "calm" | "suspect" | "spotted" {
  if (!player || !entities?.length) return "calm";
  let rank = 0;
  for (const e of entities) rank = Math.max(rank, entityThreatRank(player, e));
  return rank === 2 ? "spotted" : (rank === 1 ? "suspect" : "calm");
}

function eyeSvgMarkup(tier: string): string {
  if (tier === "hidden") {
    return '<svg class="ow-stealth-eye" viewBox="0 0 16 12" fill="none"><path d="M2 6c3.5 3 8.5 3 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
  if (tier === "shaded") {
    return '<svg class="ow-stealth-eye" viewBox="0 0 16 12" fill="none"><path d="M1.5 6c3.8-2.5 9.2-2.5 13 0-3.8 2.5-9.2 2.5-13 0Z" stroke="currentColor" stroke-width="1.3"/><rect x="7.2" y="3.8" width="1.6" height="4.4" rx="0.8" fill="currentColor"/></svg>';
  }
  return '<svg class="ow-stealth-eye" viewBox="0 0 16 12" fill="none"><path d="M1.5 6c3.8-3.2 9.2-3.2 13 0-3.8 3.2-9.2 3.2-13 0Z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="2.1" fill="currentColor"/></svg>';
}

function readStealthAndBuffs(player: PlayerSnapshot) {
  return {
    stealth: Boolean(player.crouching || player.inCover),
    vis: player.stealthVis ?? 0.8,
    cover: Boolean(player.inCover),
    fed: Math.ceil(player.wellFedTimer ?? 0),
    rest: Math.ceil(player.restedTimer ?? 0),
  };
}

function readVitals(player: PlayerSnapshot | undefined) {
  if (!player) return { hp: 100, maxHp: 100, stam: 100, maxStam: 100, safe: true, stealth: false, vis: 1, cover: false, fed: 0, rest: 0 };
  return {
    hp: Math.max(0, Math.round(player.hp ?? 100)), maxHp: Math.max(1, Math.round(player.maxHp ?? 100)),
    stam: Math.max(0, Math.round(player.stamina ?? 100)), maxStam: Math.max(1, Math.round(player.maxStamina ?? 100)),
    safe: player.inSanctuary !== false, ...readStealthAndBuffs(player),
  };
}

const staminaTierForPct = (pct: number): "high" | "mid" | "low" => (pct >= 55 ? "high" : pct >= 25 ? "mid" : "low");

function resolveStealthDisplay(opts: {
  readonly vis: number; readonly cover: boolean; readonly threat: "calm" | "suspect" | "spotted"; readonly visPct: number;
}): { readonly tier: string; readonly label: string } {
  if (opts.threat === "spotted") return { tier: "spotted", label: "SPOTTED" };
  if (opts.threat === "suspect" && opts.vis > 0.66) return { tier: "exposed", label: `ALERT ${opts.visPct}%` };
  if (opts.vis <= 0.36) return { tier: "hidden", label: `${opts.cover ? "COVER" : "HIDDEN"} ${opts.visPct}%` };
  if (opts.vis <= 0.66) return { tier: "shaded", label: `SHADED ${opts.visPct}%` };
  return { tier: "exposed", label: `EXPOSED ${opts.visPct}%` };
}

export class VitalsBar {
  readonly el: HTMLDivElement;
  readonly staminaRail: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLSpanElement;
  private readonly stamFill: HTMLDivElement;
  private readonly sanctuaryPill: HTMLSpanElement;
  private readonly stealthPill: HTMLSpanElement;
  private readonly fedPill: HTMLSpanElement;
  private readonly restedPill: HTMLSpanElement;
  private lastKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-vitals");
    const hpWrap = domNode("div", "ow-vbar ow-vbar-hp");
    this.hpFill = domNode("div", "ow-vbar-fill");
    this.hpText = domNode("span", "ow-vbar-text");
    hpWrap.append(this.hpFill, this.hpText);
    this.fedPill = domNode("span", "ow-buff-pill ow-buff-fed"); this.fedPill.hidden = true;
    this.restedPill = domNode("span", "ow-buff-pill ow-buff-rested"); this.restedPill.hidden = true;
    this.stealthPill = domNode("span", "ow-stealth-pill"); this.stealthPill.hidden = true;
    this.sanctuaryPill = domNode("span", "ow-sanctuary-pill"); this.sanctuaryPill.textContent = "Sanctuary";
    this.el.append(hpWrap, this.fedPill, this.restedPill, this.stealthPill, this.sanctuaryPill);
    this.staminaRail = domNode("div", "ow-stamina-rail");
    this.staminaRail.setAttribute("aria-label", "Stamina");
    this.stamFill = domNode("div", "ow-stamina-fill");
    this.stamFill.dataset.tier = "high";
    this.staminaRail.append(this.stamFill);
    host.append(this.el, this.staminaRail);
  }

  sync(player: PlayerSnapshot | undefined, entities?: readonly WorldEntitySnapshot[]): void {
    const v = readVitals(player);
    const threat = resolveThreatLevel(player, entities);
    const visPct = Math.round(v.vis * 100);
    const key = `${v.hp}/${v.maxHp}:${v.stam}/${v.maxStam}:${v.safe}:${v.stealth}:${v.cover}:${visPct}:${v.fed}:${v.rest}:${threat}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.syncBars(v);
    this.syncStealthEye({ show: v.stealth || threat !== "calm", vis: v.vis, cover: v.cover, threat, visPct });
  }

  private syncBars(v: ReturnType<typeof readVitals>): void {
    this.hpFill.style.width = `${Math.min(100, (v.hp / v.maxHp) * 100)}%`;
    this.hpText.textContent = `${v.hp}/${v.maxHp}`;
    const stamPct = Math.min(100, Math.max(0, (v.stam / v.maxStam) * 100));
    this.stamFill.style.height = `${stamPct}%`;
    this.stamFill.dataset.tier = staminaTierForPct(stamPct);
    this.sanctuaryPill.hidden = !v.safe;
    this.fedPill.hidden = v.fed <= 0;
    if (v.fed > 0) this.fedPill.textContent = `FED ${v.fed}s`;
    this.restedPill.hidden = v.rest <= 0;
    if (v.rest > 0) this.restedPill.textContent = `REST ${v.rest}s`;
  }

  private syncStealthEye(opts: {
    readonly show: boolean; readonly vis: number; readonly cover: boolean;
    readonly threat: "calm" | "suspect" | "spotted"; readonly visPct: number;
  }): void {
    this.stealthPill.hidden = !opts.show;
    if (!opts.show) return;
    const s = resolveStealthDisplay(opts);
    this.stealthPill.dataset.tier = s.tier;
    this.stealthPill.innerHTML = `${eyeSvgMarkup(s.tier)}<span class="ow-stealth-gem"></span><span>${s.label}</span>`;
  }
}
