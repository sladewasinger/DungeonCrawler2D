/** Centered HP bar + Sanctuary, fixed-width symbol-only Skyrim Stealth Eye, buffs/debuffs & Stamina rail. */
import type { PlayerSnapshot, WorldEntitySnapshot } from "@dc2d/engine";
import { parseStaticSvg } from "../dom/staticSvg.js";
import { BuffTray } from "./buffs/buffTray.js";
import { domNode } from "./slotRenderer.js";

const ACTIVE_ALERT_STATES = new Set(["chase", "flank", "charge", "alert"]);
const LEAF_SVG = '<svg class="ow-stealth-pip" viewBox="0 0 12 12" fill="none"><path d="M2 10C2 5 6 2 10 2c0 4-3 8-8 8Z" fill="#4ade80"/></svg>';
const FLAME_SVG = '<svg class="ow-stealth-pip" viewBox="0 0 12 12" fill="none"><path d="M6.2 1.5C8 3.6 9.2 5.3 9.2 7.2A3.2 3.2 0 1 1 2.8 7.2c0-1.5 1-2.8 2-3.9-.1 1 .4 1.6 1 1.9-.3-1.2.1-2.4.4-3.7Z" fill="#fb923c"/></svg>';
const EYE_CLOSED_PATH = "M2 7c5 3.4 11 3.4 16 0";

interface StealthEyeDom {
  readonly coverSvg: SVGElement;
  readonly flameSvg: SVGElement;
  readonly eyeOutline: SVGPathElement;
  readonly eyePupil: SVGEllipseElement;
}

function createStealthEyeDom(pill: HTMLSpanElement): StealthEyeDom {
  const coverSvg = parseStaticSvg(LEAF_SVG);
  const flameSvg = parseStaticSvg(FLAME_SVG);
  const eyeSvg = parseStaticSvg(
    '<svg class="ow-stealth-eye" viewBox="0 0 20 14" fill="none"><path d="M2 7c5 3.4 11 3.4 16 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="10" cy="7" rx="0" ry="0" fill="currentColor"/></svg>',
  );
  const eyeOutline = eyeSvg.querySelector("path")!;
  const eyePupil = eyeSvg.querySelector("ellipse")!;
  pill.append(coverSvg, eyeSvg, flameSvg);
  return { coverSvg, flameSvg, eyeOutline, eyePupil };
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

function trappedLabel(player: PlayerSnapshot): string {
  if ((player.cocoonProgress ?? 0) > 0) return "COCOONED";
  return (player.webStick ?? 0) >= 0.85 ? "STUCK" : "";
}

const ceilTimer = (n: number | undefined): number => Math.ceil(n ?? 0);

function readBuffFields(player: PlayerSnapshot) {
  return {
    fed: ceilTimer(player.wellFedTimer), rest: ceilTimer(player.restedTimer),
    invig: ceilTimer(player.invigoratedTimer), hot: ceilTimer(player.hotTimer),
    warmProg: Math.max(0, Math.min(1, player.hearthWarmProgress ?? 0)),
    buffKind: player.shrineBuff?.kind ?? "", buffSec: ceilTimer(player.shrineBuff?.remainingSec),
  };
}

function readDebuffFields(player: PlayerSnapshot) {
  return {
    poison: Math.ceil(player.poisonTimer ?? 0), poisonLocked: Boolean(player.poisonLocked),
    trapped: trappedLabel(player), burn: Math.ceil(player.burnTimer ?? 0), god: Boolean(player.godMode),
  };
}

function readStealthAndBuffs(player: PlayerSnapshot) {
  return {
    vis: player.stealthVis ?? 0.8, cover: Boolean(player.inCover), lit: Boolean(player.torchLit || player.attackFlash),
    ...readBuffFields(player),
    ...readDebuffFields(player),
  };
}

function readVitals(player: PlayerSnapshot | undefined) {
  if (!player) return { hp: 100, maxHp: 100, stam: 100, maxStam: 100, safe: true, vis: 1, cover: false, lit: false, fed: 0, rest: 0, invig: 0, hot: 0, warmProg: 0, poison: 0, poisonLocked: false, trapped: "", burn: 0, god: false, buffKind: "", buffSec: 0 };
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

export class VitalsBar {
  readonly el: HTMLDivElement;
  readonly staminaRail: HTMLDivElement;
  private readonly hpFill: HTMLDivElement;
  private readonly hpText: HTMLSpanElement;
  private readonly stamFill: HTMLDivElement;
  private readonly goldBadge: HTMLSpanElement;
  private readonly sanctuaryPill: HTMLSpanElement;
  private readonly stealthPill: HTMLSpanElement;
  private readonly stealthDom: StealthEyeDom;
  private readonly buffTray: BuffTray;
  private readonly warmingBar: HTMLDivElement;
  private readonly warmingFill: HTMLDivElement;
  private readonly warmingLabel: HTMLSpanElement;
  private lastKey = "";
  private lastStealthKey = "";

  constructor(host: HTMLElement) {
    this.el = domNode("div", "ow-vitals");
    const hpWrap = domNode("div", "ow-vbar ow-vbar-hp");
    this.hpFill = domNode("div", "ow-vbar-fill");
    this.hpText = domNode("span", "ow-vbar-text");
    hpWrap.append(this.hpFill, this.hpText);
    this.buffTray = new BuffTray(host);
    this.stealthPill = domNode("span", "ow-stealth-pill");
    this.stealthDom = createStealthEyeDom(this.stealthPill);
    this.goldBadge = domNode("span", "ow-gold-badge");
    this.goldBadge.textContent = "0g";
    this.goldBadge.dataset.gold = "0";
    this.sanctuaryPill = domNode("span", "ow-sanctuary-pill"); this.sanctuaryPill.textContent = "Sanctuary";
    this.el.append(hpWrap, this.buffTray.el, this.stealthPill, this.goldBadge, this.sanctuaryPill);
    this.warmingBar = domNode("div", "ow-warming-bar"); this.warmingBar.hidden = true;
    this.warmingFill = domNode("div", "ow-warming-fill");
    this.warmingLabel = domNode("span", "ow-warming-label");
    this.warmingBar.append(this.warmingFill, this.warmingLabel);
    this.staminaRail = domNode("div", "ow-stamina-rail");
    this.staminaRail.setAttribute("aria-label", "Stamina");
    this.stamFill = domNode("div", "ow-stamina-fill");
    this.stamFill.dataset.tier = "high";
    this.staminaRail.append(this.stamFill);
    host.append(this.el, this.warmingBar, this.staminaRail);
    this.syncStealthEye({ vis: 0.8, cover: false, lit: false, threat: "calm", open: resolveEyeOpenness(0.8, "calm"), openStep: 8, tier: "exposed" });
  }

  sync(player: PlayerSnapshot | undefined, entities?: readonly WorldEntitySnapshot[], gold?: number): void {
    this.syncGold(gold ?? player?.gold ?? 0);
    const v = readVitals(player);
    const threat = resolveThreatLevel(player, entities);
    const open = resolveEyeOpenness(v.vis, threat);
    const openStep = Math.round(open * 10);
    const tier = resolveStealthTier(v.vis, threat);
    const wp = Math.round(v.warmProg * 20);
    const key = `${v.hp}/${v.maxHp}:${v.stam}/${v.maxStam}:${v.safe}:${v.cover}:${v.lit}:${openStep}:${tier}:${v.fed}:${v.invig}:${v.rest}:${v.hot}:${wp}:${v.buffKind}:${v.buffSec}:${v.poison}:${v.poisonLocked}:${v.trapped}:${v.burn}:${v.god}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.syncBars(v);
    this.syncStealthEye({ vis: v.vis, cover: v.cover, lit: v.lit, threat, open, openStep, tier });
  }

  private syncGold(gold: number): void {
    const g = Math.max(0, Math.floor(gold));
    if (this.goldBadge.dataset.gold === String(g)) return;
    this.goldBadge.dataset.gold = String(g);
    this.goldBadge.textContent = `${g}g`;
  }

  private syncBars(v: ReturnType<typeof readVitals>): void {
    this.hpFill.style.width = `${Math.min(100, (v.hp / v.maxHp) * 100)}%`;
    this.hpText.textContent = `${v.hp}/${v.maxHp}`;
    const stamPct = Math.min(100, Math.max(0, (v.stam / v.maxStam) * 100));
    this.stamFill.style.height = `${stamPct}%`;
    this.stamFill.dataset.tier = staminaTierForPct(stamPct);
    this.sanctuaryPill.hidden = !v.safe;
    this.buffTray.sync({
      wellFedSec: v.fed, invigoratedSec: v.invig, restedSec: v.rest, hotSec: v.hot,
      shrineKind: v.buffKind, shrineSec: v.buffSec, poisonSec: v.poison, poisonLocked: v.poisonLocked,
      stuckText: v.trapped, burnSec: v.burn, god: v.god,
    });
    const warming = v.warmProg > 0 && v.warmProg < 1 && v.rest <= 0;
    this.warmingBar.hidden = !warming;
    if (warming) {
      this.warmingFill.style.width = `${Math.round(v.warmProg * 100)}%`;
      this.warmingLabel.textContent = `Warming ${(v.warmProg * 5).toFixed(1)}s`;
    }
  }

  private syncStealthEye(opts: {
    readonly vis: number; readonly cover: boolean; readonly lit: boolean;
    readonly threat: "calm" | "suspect" | "spotted"; readonly open: number; readonly openStep: number; readonly tier: string;
  }): void {
    const stealthKey = `${opts.cover}:${opts.lit}:${opts.openStep}:${opts.tier}`;
    if (stealthKey === this.lastStealthKey) return;
    this.lastStealthKey = stealthKey;
    this.stealthPill.dataset.tier = opts.tier;
    this.stealthPill.setAttribute("aria-label", `Stealth: ${opts.tier}`);
    this.stealthDom.coverSvg.dataset.on = String(opts.cover);
    this.stealthDom.flameSvg.dataset.on = String(opts.lit);
    this.updateEyeGeometry(opts.open);
  }

  private updateEyeGeometry(open: number): void {
    const { eyeOutline, eyePupil } = this.stealthDom;
    if (open < 0.14) {
      eyeOutline.setAttribute("d", EYE_CLOSED_PATH);
      eyePupil.setAttribute("rx", "0");
      eyePupil.setAttribute("ry", "0");
      return;
    }
    const h = 0.9 + open * 4.9;
    eyeOutline.setAttribute("d", `M2 7Q10 ${(7 - h).toFixed(1)} 18 7Q10 ${(7 + h).toFixed(1)} 2 7Z`);
    eyePupil.setAttribute("rx", Math.min(2.5, 0.7 + open * 1.8).toFixed(1));
    eyePupil.setAttribute("ry", Math.min(2.7, h * 0.48).toFixed(1));
  }
}
