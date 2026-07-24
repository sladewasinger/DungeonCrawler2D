/** Presents transient toasts, interaction prompts, reconnect state, and boss health above both renderers. */
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

export class ThreeHudNotices {
  readonly element = document.createElement("div");
  private readonly boss = document.createElement("div");
  private readonly bossFill = document.createElement("div");
  private readonly bossLabel = document.createElement("div");
  private readonly toast = document.createElement("div");
  private readonly interaction = document.createElement("div");
  private readonly reconnect = document.createElement("div");

  constructor() {
    this.element.style.cssText =
      "position:absolute;inset:0;z-index:1080;pointer-events:none";
    this.configureBoss();
    this.toast.style.cssText =
      "position:absolute;left:50%;top:12%;translate:-50% 0;max-width:70vw;" +
      "padding:6px 10px;background:rgba(17,18,29,.82);text-align:center";
    this.interaction.style.cssText =
      "position:absolute;left:50%;bottom:25%;translate:-50% 0;padding:6px 10px;" +
      "background:rgba(17,18,29,.78);border:1px solid #555a75";
    this.reconnect.style.cssText =
      `position:absolute;left:50%;top:5%;translate:-50% 0;color:${HUD_GOLD}`;
    this.element.append(
      this.boss,
      this.toast,
      this.interaction,
      this.reconnect,
    );
  }

  update(snapshot: HudFakeSnapshot, nowMs: number): void {
    this.updateBoss(snapshot);
    const toast = [...snapshot.toasts]
      .reverse()
      .find((entry) => entry.until > nowMs);
    this.toast.hidden = !toast;
    this.toast.textContent = toast?.msg ?? "";
    this.interaction.hidden = snapshot.interactionPrompt === null;
    this.interaction.textContent = snapshot.interactionPrompt
      ? `[${snapshot.interactionPrompt.key}] ${snapshot.interactionPrompt.label}`
      : "";
    this.reconnect.hidden = !snapshot.reconnecting;
    this.reconnect.textContent =
      `Reconnecting${snapshot.reconnectAttempts > 0
        ? ` - attempt ${snapshot.reconnectAttempts}`
        : "..."}`;
  }

  private configureBoss(): void {
    this.boss.style.cssText =
      "position:absolute;left:50%;top:4%;translate:-50% 0;width:min(420px,54vw);" +
      "height:28px;padding:4px;border:1px solid #6a6071;background:#17131d;" +
      "box-sizing:border-box;text-align:center";
    this.bossFill.style.cssText =
      "position:absolute;inset:4px;width:0;background:#a53343";
    this.bossLabel.style.cssText =
      "position:absolute;inset:0;display:grid;place-items:center;" +
      "font-weight:700;text-shadow:0 1px 3px #000";
    this.boss.append(this.bossFill, this.bossLabel);
  }

  private updateBoss(snapshot: HudFakeSnapshot): void {
    const boss = snapshot.boss;
    this.boss.hidden = boss === null;
    if (!boss) return;
    const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.bossLabel.textContent = `${boss.name} ${boss.hp} / ${boss.maxHp}`;
    this.boss.setAttribute("aria-label", `${boss.name}: ${boss.hp} / ${boss.maxHp}`);
  }
}
