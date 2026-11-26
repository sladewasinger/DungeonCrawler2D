/** Golden pulsing aura ring and Tier/Elite nameplates rendered for frontier creatures. */
import type { WorldEntitySnapshot } from "@dc2d/engine";
import { Graphics, Text } from "pixi.js";

const FONT_STYLE = {
  fontFamily: "\"Trebuchet MS\", system-ui, sans-serif",
  fontSize: 9,
  fontWeight: "bold" as const,
  fill: "#fde047",
  stroke: { color: "#090d14", width: 3 },
};

const TIER_ROMAN: Readonly<Record<number, string>> = { 2: "T II", 3: "T III", 4: "T IV", 5: "☠ T V" };
const TIER_COLORS: Readonly<Record<number, string>> = { 2: "#fbbf24", 3: "#fb923c", 4: "#c084fc", 5: "#f87171" };

function resolveEliteBadge(snap: WorldEntitySnapshot, tier: number, tierPrefix?: string): { readonly key: string; readonly color: string } {
  const name = snap.title ?? "Elite";
  const key = tierPrefix ? `★ ${tierPrefix} ${name}` : `★ ${name}`;
  const color = tier >= 4 ? (TIER_COLORS[tier] ?? "#fde047") : "#fde047";
  return { key, color };
}

function resolveEnemyBadge(snap: WorldEntitySnapshot): { readonly key: string; readonly color: string } | null {
  const tier = snap.dangerTier ?? 1;
  const tierPrefix = TIER_ROMAN[tier];
  if (snap.isElite) return resolveEliteBadge(snap, tier, tierPrefix);
  return tierPrefix ? { key: tierPrefix, color: TIER_COLORS[tier] ?? "#fbbf24" } : null;
}

export class EliteVisuals {
  readonly aura = new Graphics();
  readonly label = new Text({ text: "", style: FONT_STYLE });
  private lastTitle = "";
  private lastColor = "#fde047";

  constructor(private readonly topY: number) {
    this.aura.visible = false;
    this.label.anchor.set(0.5, 1);
    this.label.visible = false;
  }

  private syncAura(elite: boolean, timeSec: number): void {
    this.aura.visible = elite;
    if (!elite) return;
    const pulse = 1 + Math.sin(timeSec * 4.2) * 0.08;
    this.aura.clear();
    this.aura.ellipse(0, 1, 13 * pulse, 7 * pulse).stroke({ color: 0xfacc15, width: 1.8, alpha: 0.78 });
    this.aura.ellipse(0, 1, 10 * pulse, 5.2 * pulse).fill({ color: 0xf59e0b, alpha: 0.16 });
  }

  sync(snap: WorldEntitySnapshot, dead: boolean, timeSec: number): void {
    const elite = Boolean(snap.isElite) && !dead;
    this.syncAura(elite, timeSec);
    const badge = dead ? null : resolveEnemyBadge(snap);
    this.label.visible = badge !== null;
    if (!badge) return;
    if (this.lastTitle !== badge.key) {
      this.lastTitle = badge.key;
      this.label.text = badge.key;
    }
    if (this.lastColor !== badge.color) {
      this.lastColor = badge.color;
      this.label.style.fill = badge.color;
    }
    this.label.position.set(0, this.topY - 7);
  }
}
