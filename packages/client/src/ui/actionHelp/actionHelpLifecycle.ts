import type {
  ContextualAction,
  ContextualActionHint,
} from "./actionHelp.js";

export const COMBAT_ACTION_HELP_TIMEOUT_MS = 60_000;

const isCombatAction = (
  action: ContextualAction,
): action is "attack" | "block" =>
  action === "attack" || action === "block";

export class ActionHelpLifecycle {
  private combatHelpStartedAt: number | null = null;

  visibleHints(
    hints: readonly ContextualActionHint[],
    completedActions: ReadonlySet<ContextualAction>,
    nowMs: number,
  ): ContextualActionHint[] {
    const hasCombatHelp = hints.some((hint) => isCombatAction(hint.action));
    if (hasCombatHelp) this.combatHelpStartedAt ??= nowMs;
    const combatHelpExpired = this.combatHelpStartedAt !== null &&
      nowMs - this.combatHelpStartedAt >= COMBAT_ACTION_HELP_TIMEOUT_MS;
    return hints.filter((hint) =>
      !isCombatAction(hint.action) ||
      (!combatHelpExpired && !completedActions.has(hint.action))
    );
  }
}
