import { describe, expect, it } from "vitest";
import type {
  ContextualAction,
  ContextualActionHint,
} from "./actionHelp.js";
import {
  ActionHelpLifecycle,
  COMBAT_ACTION_HELP_TIMEOUT_MS,
} from "./actionHelpLifecycle.js";

const hints: ContextualActionHint[] = [
  { action: "use", key: "E", touchKey: "USE", label: "Use Bandage" },
  {
    action: "attack",
    key: "LMB",
    touchKey: "ATTACK",
    label: "Attack with Rusty Sword",
  },
  {
    action: "block",
    key: "RMB",
    touchKey: "BLOCK",
    label: "Block with Rusty Sword",
  },
];

describe("ActionHelpLifecycle", () => {
  it("removes each combat hint after that action is used", () => {
    const lifecycle = new ActionHelpLifecycle();
    const visible = lifecycle.visibleHints(
      hints,
      new Set<ContextualAction>(["attack", "block"]),
      1_000,
    );
    expect(visible.map(({ action }) => action)).toEqual(["use"]);
  });

  it("expires combat help after sixty seconds but keeps contextual item help", () => {
    const lifecycle = new ActionHelpLifecycle();
    expect(lifecycle.visibleHints(hints, new Set(), 1_000)).toHaveLength(3);
    const visible = lifecycle.visibleHints(
      hints,
      new Set(),
      1_000 + COMBAT_ACTION_HELP_TIMEOUT_MS,
    );
    expect(visible.map(({ action }) => action)).toEqual(["use"]);
  });
});
