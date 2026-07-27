/** Presents transient toasts, interaction prompts, reconnect state, and boss health above both renderers. */
import type { HudFakeSnapshot } from "../ui/widgets/hud/fakeData.js";
import { inputModality } from "../input/inputModality.js";
import type {
  ContextualAction,
  ContextualActionHint,
} from "../ui/actionHelp.js";
import { ActionHelpLifecycle } from "../ui/actionHelpLifecycle.js";
import { HUD_GOLD } from "./ThreeHudStyles.js";

export type ThreeHudNoticeState = Pick<
  HudFakeSnapshot,
  "actionHints" | "boss" | "interactionPrompt" | "reconnecting" |
  "reconnectAttempts" | "toasts"
> & {
  readonly completedContextualActions?: readonly ContextualAction[];
};

export function contextualHelpText(
  prompt: ThreeHudNoticeState["interactionPrompt"],
  actionHints: readonly ContextualActionHint[],
  touchDevice: boolean,
): string {
  const promptText = prompt ? actionText(prompt, touchDevice) : "";
  return [promptText, ...actionHints.map((hint) => actionText(hint, touchDevice))]
    .filter(Boolean)
    .join("   ·   ");
}

interface NoticeActionHint {
  key: string;
  label: string;
  touchKey?: string;
}

const actionText = (hint: NoticeActionHint, touchDevice: boolean): string =>
  `[${touchDevice ? hint.touchKey ?? "USE" : hint.key}] ${hint.label}`;

export function latestVisibleToast(
  toasts: ThreeHudNoticeState["toasts"],
  nowMs: number,
) {
  for (let index = toasts.length - 1; index >= 0; index--) {
    const toast = toasts[index];
    if (toast && toast.until > nowMs) return toast;
  }
  return undefined;
}

export class ThreeHudNotices {
  readonly element = document.createElement("div");
  private readonly boss = document.createElement("div");
  private readonly bossFill = document.createElement("div");
  private readonly bossLabel = document.createElement("div");
  private readonly toast = document.createElement("div");
  private readonly interaction = document.createElement("div");
  private readonly reconnect = document.createElement("div");
  private readonly actionHelp = new ActionHelpLifecycle();
  private readonly completedActions = new Set<ContextualAction>();

  constructor() {
    this.element.style.cssText =
      "position:absolute;inset:0;z-index:1080;pointer-events:none";
    this.configureBoss();
    this.toast.style.cssText =
      "position:absolute;left:50%;top:12%;translate:-50% 0;max-width:70vw;" +
      "padding:6px 10px;background:rgba(17,18,29,.82);text-align:center";
    this.interaction.style.cssText =
      "position:absolute;left:50%;bottom:25%;translate:-50% 0;padding:5px 9px;" +
      "max-width:min(720px,88vw);box-sizing:border-box;text-align:center;" +
      "background:rgba(17,18,29,.72);border:1px solid #555a75";
    this.reconnect.style.cssText =
      `position:absolute;left:50%;top:5%;translate:-50% 0;color:${HUD_GOLD}`;
    this.element.append(
      this.boss,
      this.toast,
      this.interaction,
      this.reconnect,
    );
  }

  update(snapshot: ThreeHudNoticeState, nowMs: number): void {
    this.updateBoss(snapshot);
    this.updateToast(snapshot, nowMs);
    this.updateInteraction(snapshot, nowMs);
    this.updateReconnect(snapshot);
  }

  private updateToast(snapshot: ThreeHudNoticeState, nowMs: number): void {
    const toast = latestVisibleToast(snapshot.toasts, nowMs);
    this.toast.hidden = !toast;
    this.toast.textContent = toast?.msg ?? "";
  }

  private updateInteraction(snapshot: ThreeHudNoticeState, nowMs: number): void {
    this.completedActions.clear();
    for (const action of snapshot.completedContextualActions ?? []) this.completedActions.add(action);
    const visibleActionHints = this.actionHelp.visibleHints(
      snapshot.actionHints,
      this.completedActions,
      nowMs,
    );
    const helpText = contextualHelpText(
      snapshot.interactionPrompt,
      visibleActionHints,
      inputModality.current === "touch",
    );
    this.interaction.hidden = helpText.length === 0;
    this.interaction.textContent = helpText;
  }

  private updateReconnect(snapshot: ThreeHudNoticeState): void {
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

  private updateBoss(snapshot: ThreeHudNoticeState): void {
    const boss = snapshot.boss;
    this.boss.hidden = boss === null;
    if (!boss) return;
    const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.bossLabel.textContent = `${boss.name} ${boss.hp} / ${boss.maxHp}`;
    this.boss.setAttribute("aria-label", `${boss.name}: ${boss.hp} / ${boss.maxHp}`);
  }
}
