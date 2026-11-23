/** Centered HP bar + Sanctuary, fixed-width symbol-only Skyrim Stealth Eye, buffs/debuffs & Stamina rail. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { domNode } from "./slotRenderer.js";

const ACTIVE_ALERT_STATES = new Set(["chase", "flank", "charge", "alert"]);
const LEAF_PATH = '<path d="M2 10C2 5 6 2 10 2c0 4-3 8-8 8Z" fill="#4ade80"/>';
const FLAME_PATH = '<path d="M6.2 1.5C8 3.6 9.2 5.3 9.2 7.2A3.2 3.2 0 1 1 2.8 7.2c0-1.5 1-2.8 2-3.9-.1 1 .4 1.6 1 1.9-.3-1.2.1-2.4.4-3.7Z" fill="#fb923c"/>';

function pipMarkup(on: boolean, path: string): string {
  return `<svg class="ow-stealth-pip" data-on="${on}" viewBox="0 0 12 12" fill="none">${path}</svg>`;
}

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

function eyeSvgMarkup(open: number): string {
  if (open < 0.14) {
    return '<svg class="ow-stealth-eye" viewBox="0 0 20 14" fill="none"><path d="M2 7c5 3.4 11 3.4 16 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
  const h = 0.9 + open * 4.9;
  const rx = Math.min(2.5, 0.7 + open * 1.8).toFixed(1);
  const ry = Math.min(2.7, h * 0.48).toFixed(1);
  return `<svg class="ow-stealth-eye" viewBox="0 0 20 14" fill="none"><path d="M2 7Q10 ${(7 - h).toFixed(1)} 18 7Q10 ${(7 + h).toFixed(1)} 2 7Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="10" cy="7" rx="${rx}" ry="${ry}" fill="currentColor"/></svg>`;
}

function trappedLabel(player: PlayerSnapshot): string {
  if ((player.cocoonProgress ?? 0) > 0) return "COCOONED";
  return (player.webStick ?? 0) >= 0.85 ? "STUCK" : "";
}

function readStealthAndBuffs(player: PlayerSnapshot) {
  return {
    vis: player.stealthVis ?? 0.8, cover: Boolean(player.inCover), lit: Boolean(player.torchLit || player.attackFlash),
    fed: Math.ceil(player.wellFedTimer ?? 0), rest: Math.ceil(player.restedTimer ?? 0),
    poison: Math.ceil(player.poisonTimer ?? 0), poisonLocked: Boolean(player.poisonLocked),
    trapped: trappedLabel(player), burn: Math.ceil(player.burnTimer ?? 0), god: Boolean(player.godMode),
  };
}

function readVitals(player: PlayerSnapshot | undefined) {
  if (!player) return { hp: 100, maxHp: 100, stam: 100, maxStam: 100, safe: true, vis: 1, cover: false, lit: false, fed: 0, rest: 0, poison: 0, poisonLocked: false, trapped: "", burn: 0, god: false };
  return {
    hp: Math.max(0, Math.round(player.hp ?? 100)), maxHp: Math.max(1, Math.round(player.maxHp ?? 100)),
    stam: Math.max(0, Math.round(player.stamina ?? 100)), maxStam: Math.max(1, Math.round(player.maxStamina ?? 100)),
    safe: player.inSanctuary !== false, ...readStealthAndBuffs(player),
  };
}

const staminaTierForPct = (pct: number): "high" | "mid" | "low" => (pct >= 55 ? "high" : pct >= 25 ? "mid" : "low");

function resolveEyeOpenness(vis: number, threat: "calm" | "suspect" | "spotted"): number {
  if (threat === "spotted") return 1.0;
  if (threat === "suspect") return Math.max(0.55, vis);
  return Math.max(0, Math.min(1, (vis - 0.14) / 0.78));
}

function resolveStealthTier(vis: number, threat: "calm" | "suspect" | "spotted"): string {
  if (threat === "spotted") return "spotted";
  if (threat === "suspect" && vis > 0.66) return "exposed";
  if (vis <= 0.36) return "hidden";
  return vis <= 0.66 ? "shaded" : "exposed";
}

function syncStatusPill(el: HTMLSpanElement, secs: number, label: string): void {
  el.hidden = secs <= 0;
  if (secs > 0) el.textContent = `${label} ${secs}s`;
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
  private readonly poisonPill: HTMLSpanElement;
  private readonly trappedPill: HTMLSpanElement;
  private readonly burnPill: HTMLSpanElement;
  private readonly godPill: HTMLSpanElement;
  private lastKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-vitals");
    const hpWrap = domNode("div", "ow-vbar ow-vbar-hp");
    this.hpFill = domNode("div", "ow-vbar-fill");
    this.hpText = domNode("span", "ow-vbar-text");
    hpWrap.append(this.hpFill, this.hpText);
    this.fedPill = domNode("span", "ow-buff-pill ow-buff-fed"); this.fedPill.hidden = true;
    this.restedPill = domNode("span", "ow-buff-pill ow-buff-rested"); this.restedPill.hidden = true;
    this.poisonPill = domNode("span", "ow-buff-pill ow-buff-poison"); this.poisonPill.hidden = true;
    this.trappedPill = domNode("span", "ow-buff-pill ow-buff-web"); this.trappedPill.hidden = true;
    this.burnPill = domNode("span", "ow-buff-pill ow-buff-burn"); this.burnPill.hidden = true;
    this.godPill = domNode("span", "ow-buff-pill ow-buff-god"); this.godPill.textContent = "GOD"; this.godPill.hidden = true;
    this.stealthPill = domNode("span", "ow-stealth-pill");
    this.sanctuaryPill = domNode("span", "ow-sanctuary-pill"); this.sanctuaryPill.textContent = "Sanctuary";
    this.el.append(hpWrap, this.fedPill, this.restedPill, this.poisonPill, this.trappedPill, this.burnPill, this.godPill, this.stealthPill, this.sanctuaryPill);
    this.staminaRail = domNode("div", "ow-stamina-rail");
    this.staminaRail.setAttribute("aria-label", "Stamina");
    this.stamFill = domNode("div", "ow-stamina-fill");
    this.stamFill.dataset.tier = "high";
    this.staminaRail.append(this.stamFill);
    host.append(this.el, this.staminaRail);
    this.syncStealthEye({ vis: 0.8, cover: false, lit: false, threat: "calm", open: resolveEyeOpenness(0.8, "calm") });
  }

  sync(player: PlayerSnapshot | undefined, entities?: readonly WorldEntitySnapshot[]): void {
    const v = readVitals(player);
    const threat = resolveThreatLevel(player, entities);
    const open = resolveEyeOpenness(v.vis, threat);
    const openStep = Math.round(open * 10);
    const tier = resolveStealthTier(v.vis, threat);
    const key = `${v.hp}/${v.maxHp}:${v.stam}/${v.maxStam}:${v.safe}:${v.cover}:${v.lit}:${openStep}:${tier}:${v.fed}:${v.rest}:${v.poison}:${v.poisonLocked}:${v.trapped}:${v.burn}:${v.god}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.syncBars(v);
    this.syncStealthEye({ vis: v.vis, cover: v.cover, lit: v.lit, threat, open });
  }

  private syncBars(v: ReturnType<typeof readVitals>): void {
    this.hpFill.style.width = `${Math.min(100, (v.hp / v.maxHp) * 100)}%`;
    this.hpText.textContent = `${v.hp}/${v.maxHp}`;
    const stamPct = Math.min(100, Math.max(0, (v.stam / v.maxStam) * 100));
    this.stamFill.style.height = `${stamPct}%`;
    this.stamFill.dataset.tier = staminaTierForPct(stamPct);
    this.sanctuaryPill.hidden = !v.safe;
    syncStatusPill(this.fedPill, v.fed, "FED");
    syncStatusPill(this.restedPill, v.rest, "REST");
    this.poisonPill.hidden = v.poison <= 0 && !v.poisonLocked;
    if (!this.poisonPill.hidden) this.poisonPill.textContent = v.poisonLocked ? "POISONED" : `POISONED ${v.poison}s`;
    this.trappedPill.hidden = v.trapped.length === 0;
    if (v.trapped) this.trappedPill.textContent = v.trapped;
    syncStatusPill(this.burnPill, v.burn, "BURNING");
    this.godPill.hidden = !v.god;
  }

  private syncStealthEye(opts: {
    readonly vis: number; readonly cover: boolean; readonly lit: boolean;
    readonly threat: "calm" | "suspect" | "spotted"; readonly open: number;
  }): void {
    const tier = resolveStealthTier(opts.vis, opts.threat);
    this.stealthPill.dataset.tier = tier;
    this.stealthPill.setAttribute("aria-label", `Stealth: ${tier}`);
    this.stealthPill.innerHTML = `${pipMarkup(opts.cover, LEAF_PATH)}${eyeSvgMarkup(opts.open)}${pipMarkup(opts.lit, FLAME_PATH)}`;
  }
}
