/** Non-blocking full-screen damage vignette, low-HP pulse, and fallen respawn banner. */
import type { PlayerSnapshot, WorldEvent } from "@dc2d/engine";

function makeRoot(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:12;overflow:hidden;";
  return el;
}

function makeVignette(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;inset:0;opacity:0;transition:opacity 75ms ease-out;"
    + "box-shadow:inset 0 0 88px 28px rgba(220,38,38,0.88);"
    + "background:radial-gradient(circle,transparent 56%,rgba(185,28,28,0.42) 100%);";
  return el;
}

function makeBanner(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"
    + "background:rgba(9,11,16,0.44);opacity:0;transition:opacity 220ms ease;text-align:center;"
    + "font-family:system-ui,-apple-system,sans-serif;user-select:none;";
  const title = document.createElement("div");
  title.textContent = "YOU FELL";
  title.style.cssText = "font-size:38px;font-weight:900;letter-spacing:0.14em;color:#f87171;text-shadow:0 3px 16px rgba(0,0,0,0.85);";
  const sub = document.createElement("div");
  sub.textContent = "Returning to Sanctuary...";
  sub.style.cssText = "margin-top:8px;font-size:14px;font-weight:600;letter-spacing:0.06em;color:#e2e8f0;text-shadow:0 2px 8px rgba(0,0,0,0.85);";
  el.append(title, sub);
  return el;
}

export class CombatFeedbackOverlay {
  private readonly root = makeRoot();
  private readonly vignette = makeVignette();
  private readonly banner = makeBanner();
  private flashOpacity = 0;

  constructor(host: HTMLElement) {
    this.root.append(this.vignette, this.banner);
    host.appendChild(this.root);
  }

  sync(opts: {
    readonly local: PlayerSnapshot | undefined;
    readonly events: readonly WorldEvent[];
    readonly localId: string;
    readonly dt: number;
  }): void {
    const { local, events, localId, dt } = opts;
    const hitTimer = local?.hitTimer ?? 0;
    const hurtEvent = events.some((e) => e.kind === "hit" && e.targetId === localId);
    this.flashOpacity = hurtEvent || hitTimer > 0.16 ? Math.max(this.flashOpacity, 0.85) : Math.max(0, this.flashOpacity - dt * 2.8);
    const downed = (local?.respawnTimer ?? 0) > 0;
    const vigAlpha = resolveVignetteAlpha({ local, hitTimer, flashOpacity: this.flashOpacity, downed });
    this.vignette.style.opacity = vigAlpha.toFixed(3);
    this.banner.style.opacity = downed ? "1" : "0";
  }
}

function resolveVignetteAlpha(q: {
  readonly local: PlayerSnapshot | undefined; readonly hitTimer: number; readonly flashOpacity: number; readonly downed: boolean;
}): number {
  if (q.downed) return 0.65;
  const hitFloor = q.hitTimer > 0 ? Math.min(0.65, q.hitTimer * 2.4) : 0;
  return Math.max(q.flashOpacity, hitFloor, computeLowHpPulse(q.local));
}

function computeLowHpPulse(local: PlayerSnapshot | undefined): number {
  if (!local || (local.respawnTimer ?? 0) > 0) return 0;
  const maxHp = Math.max(1, local.maxHp ?? 100);
  const hp = local.hp ?? maxHp;
  if (hp <= 0 || hp / maxHp > 0.3) return 0;
  return 0.2 + (Math.sin(performance.now() * 0.0052) * 0.5 + 0.5) * 0.22;
}
