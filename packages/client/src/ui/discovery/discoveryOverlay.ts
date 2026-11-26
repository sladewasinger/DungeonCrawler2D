/** Top-center Biome Entry Banners (debounced 6s) and POI Discovery / Shrine / Vault Toasts. */
import { getBiomeEntry } from "@dc2d/content";
import { computeDangerTier, sampleMacroBiome, type BiomeKind, type WorldEvent } from "@dc2d/engine";
import { ensureDiscoveryStyles } from "./discoveryStyles.js";

const TOAST_EVENTS = new Set<WorldEvent["kind"]>(["poiDiscover", "shrineActivate", "waystoneAttune", "vaultUnlock", "loreRead"]);
const ROMAN_TIERS: Readonly<Record<number, string>> = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const BIOME_DEBOUNCE_MS = 6000;
const BANNER_VISIBLE_MS = 3200;
const TOAST_VISIBLE_MS = 3800;

export class DiscoveryOverlay {
  private readonly bannerEl: HTMLDivElement;
  private readonly bannerTitle: HTMLDivElement;
  private readonly bannerSub: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly toastTitle: HTMLDivElement;
  private readonly toastSub: HTMLDivElement;
  private lastBiome: BiomeKind | null = null;
  private readonly biomeShownAtMs = new Map<BiomeKind, number>();
  private bannerUntilMs = 0;
  private toastUntilMs = 0;

  constructor(host: HTMLElement) {
    ensureDiscoveryStyles();
    this.bannerEl = document.createElement("div");
    this.bannerEl.className = "ow-biome-banner";
    this.bannerTitle = document.createElement("div");
    this.bannerTitle.className = "ow-biome-title";
    this.bannerSub = document.createElement("div");
    this.bannerSub.className = "ow-biome-sub";
    this.bannerEl.append(this.bannerTitle, this.bannerSub);

    this.toastEl = document.createElement("div");
    this.toastEl.className = "ow-discovery-toast";
    this.toastTitle = document.createElement("div");
    this.toastTitle.className = "ow-discovery-title";
    this.toastSub = document.createElement("div");
    this.toastSub.className = "ow-discovery-sub";
    this.toastEl.append(this.toastTitle, this.toastSub);
    host.append(this.bannerEl, this.toastEl);
  }

  private checkBiomeTransition(opts: { readonly x: number; readonly y: number; readonly worldSeed: number; readonly nowMs: number }): void {
    const biome = sampleMacroBiome(opts.worldSeed, opts.x, opts.y);
    if (this.lastBiome === null) { this.lastBiome = biome; return; }
    if (biome === this.lastBiome) return;
    this.lastBiome = biome;
    const prev = this.biomeShownAtMs.get(biome) ?? 0;
    if (opts.nowMs - prev < BIOME_DEBOUNCE_MS) return;
    this.biomeShownAtMs.set(biome, opts.nowMs);
    const entry = getBiomeEntry(biome);
    const tier = computeDangerTier(biome, opts.x, opts.y);
    this.bannerTitle.textContent = entry.displayName;
    this.bannerTitle.style.color = entry.accentHex;
    this.bannerSub.textContent = `Danger Tier ${ROMAN_TIERS[tier] ?? tier} · ${entry.subtitle}`;
    this.bannerUntilMs = opts.nowMs + BANNER_VISIBLE_MS;
  }

  private showEventToast(ev: WorldEvent, nowMs: number, onChime?: () => void): void {
    const prefix = ev.kind === "poiDiscover" ? "✦ Discovered: " : "";
    this.toastTitle.textContent = `${prefix}${ev.label ?? "Landmark"}`;
    this.toastSub.textContent = ev.subtitle ?? "";
    this.toastUntilMs = nowMs + TOAST_VISIBLE_MS;
    onChime?.();
  }

  private handleDiscoveryEvents(opts: {
    readonly events: readonly WorldEvent[]; readonly localPlayerId: string;
    readonly nowMs: number; readonly onChime?: (() => void) | undefined;
  }): void {
    for (const ev of opts.events) {
      if (!TOAST_EVENTS.has(ev.kind)) continue;
      if (ev.actorId && ev.actorId !== opts.localPlayerId) continue;
      this.showEventToast(ev, opts.nowMs, opts.onChime);
    }
  }

  sync(opts: {
    readonly x: number; readonly y: number; readonly worldSeed: number;
    readonly events: readonly WorldEvent[]; readonly localPlayerId: string;
    readonly nowMs: number; readonly onChime?: (() => void) | undefined;
  }): void {
    this.checkBiomeTransition(opts);
    this.handleDiscoveryEvents(opts);
    this.bannerEl.classList.toggle("visible", opts.nowMs < this.bannerUntilMs);
    this.toastEl.classList.toggle("visible", opts.nowMs < this.toastUntilMs);
  }
}
