/** Presents transient toasts, interaction prompts, reconnect state, and boss health above both renderers. */
import type { HudFakeSnapshot } from "../../../ui/widgets/hud/core/fakeData.js";
import { inputModality } from "../../../input/controls/inputModality.js";
import type {
  ContextualAction,
  ContextualActionHint,
} from "../../../ui/actionHelp/actionHelp.js";
import { ActionHelpLifecycle } from "../../../ui/actionHelp/actionHelpLifecycle.js";
import { createHudTemplate, requireHudElement } from "../styles/hudTemplate.js";

export type HudNoticeState = Pick<
  HudFakeSnapshot,
  "actionHints" | "boss" | "interactionPrompt" | "reconnecting" |
  "reconnectAttempts" | "toasts"
> & {
  readonly completedContextualActions?: readonly ContextualAction[];
};

export function contextualHelpText(
  prompt: HudNoticeState["interactionPrompt"],
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
  touchLabel?: string;
}

const actionText = (hint: NoticeActionHint, touchDevice: boolean): string => {
  const key = touchDevice ? hint.touchKey ?? "USE" : hint.key;
  const label = touchDevice ? hint.touchLabel ?? hint.label : hint.label;
  return `[${key}] ${label}`;
};

export function latestVisibleToast(
  toasts: HudNoticeState["toasts"],
  nowMs: number,
) {
  for (let index = toasts.length - 1; index >= 0; index--) {
    const toast = toasts[index];
    if (toast && toast.until > nowMs) return toast;
  }
  return undefined;
}

export class HudNotices {
  readonly element = createHudTemplate<HTMLDivElement>("hud-notices-template");
  private readonly boss = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-boss]");
  private readonly bossFill = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-boss-fill]");
  private readonly bossLabel = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-boss-label]");
  private readonly toast = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-toast]");
  private readonly interaction = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-prompt]");
  private readonly reconnect = requireHudElement<HTMLDivElement>(this.element, "[data-hud-notice-reconnect]");
  private readonly actionHelp = new ActionHelpLifecycle();
  private readonly completedActions = new Set<ContextualAction>();

  constructor() {
    this.boss.hidden = true;
  }

  update(snapshot: HudNoticeState, nowMs: number): void {
    this.updateBoss(snapshot);
    this.updateToast(snapshot, nowMs);
    this.updateInteraction(snapshot, nowMs);
    this.updateReconnect(snapshot);
  }

  private updateToast(snapshot: HudNoticeState, nowMs: number): void {
    const toast = latestVisibleToast(snapshot.toasts, nowMs);
    this.toast.hidden = !toast;
    this.toast.textContent = toast?.msg ?? "";
  }

  private updateInteraction(snapshot: HudNoticeState, nowMs: number): void {
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

  private updateReconnect(snapshot: HudNoticeState): void {
    this.reconnect.hidden = !snapshot.reconnecting;
    this.reconnect.textContent =
      `Reconnecting${snapshot.reconnectAttempts > 0
        ? ` - attempt ${snapshot.reconnectAttempts}`
        : "..."}`;
  }

  private updateBoss(snapshot: HudNoticeState): void {
    const boss = snapshot.boss;
    this.boss.hidden = boss === null;
    if (!boss) return;
    const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
    this.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    this.bossLabel.textContent = `${boss.name} ${boss.hp} / ${boss.maxHp}`;
    this.boss.setAttribute("aria-label", `${boss.name}: ${boss.hp} / ${boss.maxHp}`);
  }
}
