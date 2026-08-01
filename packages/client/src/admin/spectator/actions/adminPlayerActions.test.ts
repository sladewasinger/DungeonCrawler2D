import type { AdminPlayer } from "@dc2d/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adminSpectatorActions,
  renderAdminPlayerActions,
} from "./adminPlayerActions.js";

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly classList = { add: (...names: string[]) => names.forEach((name) => this.classes.add(name)) };
  readonly classes = new Set<string>();
  readonly style = { cssText: "" };
  textContent = "";
  disabled = false;

  get className(): string {
    return [...this.classes].join(" ");
  }

  set className(value: string) {
    this.classes.clear();
    value.split(" ").filter(Boolean).forEach((name) => this.classes.add(name));
  }

  append(...elements: TestElement[]): void {
    this.children.push(...elements);
  }

  replaceChildren(...elements: TestElement[]): void {
    this.children.splice(0, this.children.length, ...elements);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

const PLAYER = {
  playerId: "player-1",
  x: 0,
  y: 0,
  god: false,
  handicapped: false,
  admin: false,
} as AdminPlayer;

let originalDocument: Document | undefined;
beforeEach(() => {
  originalDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => new TestElement() },
  });
});
afterEach(() => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
});
describe("admin spectator actions", () => {
  it("uses one pressed switch action for both spectator states", () => {
    expect(adminSpectatorActions("off")[0]).toEqual([
      "Spectate",
      "spectator-toggle",
      false,
    ]);
    expect(adminSpectatorActions("track")[0]).toEqual([
      "Spectate",
      "spectator-toggle",
      true,
    ]);
  });

  it("retains camera mode controls and adds live zoom controls", () => {
    const actions = adminSpectatorActions("free");
    expect(actions).toContainEqual(["Free camera", "spectate", true]);
    expect(actions).toContainEqual(["−", "spectator-zoom-out"]);
    expect(actions).toContainEqual(["+", "spectator-zoom-in"]);
  });

  it.each([
    { enabled: false, state: "OFF", actions: ["god-on", "handicap-on", "admin-on"] },
    { enabled: true, state: "ON", actions: ["god-off", "handicap-off", "admin-off"] },
  ])("renders stable mode labels and state", ({ enabled, state, actions: modeActions }) => {
    const [godAction, handicapAction, adminAction] = modeActions as [string, string, string];
    const actions = new TestElement();
    renderAdminPlayerActions({
      actions: actions as unknown as HTMLElement,
      player: { ...PLAYER, god: enabled, handicapped: enabled, admin: enabled },
      authenticated: true,
      tracking: false,
      spectatorMode: "off",
    });

    expect(modeControls(actions)).toEqual([
      modeControl("God", godAction, state),
      modeControl("Handicap", handicapAction, state),
      modeControl("Admin", adminAction, state),
    ]);
    for (const control of modeElements(actions)) {
      expect(control.attributes.get("role")).toBe("switch");
      expect(control.attributes.get("aria-checked")).toBe(String(enabled));
      expect(control.classes.has("toggle-switch")).toBe(true);
      const track = control.children[2];
      expect(track).toBeDefined();
      if (!track) continue;
      expect(track.classes.has("toggle-switch__track")).toBe(true);
      const knob = track.children[0];
      expect(knob).toBeDefined();
      if (!knob) continue;
      expect(knob.classes.has("toggle-switch__knob")).toBe(true);
    }
  });
  it("disables unauthenticated mode switches while retaining player IDs", () => {
    const actions = new TestElement();
    renderAdminPlayerActions({
      actions: actions as unknown as HTMLElement,
      player: PLAYER,
      authenticated: false,
      tracking: false,
      spectatorMode: "off",
    });

    for (const control of modeElements(actions)) {
      expect(control.disabled).toBe(true);
      expect(control.dataset.playerId).toBe("player-1");
    }
  });
  it("refreshes when tracked state changes without changing mode commands", () => {
    const actions = new TestElement();
    const input = {
      actions: actions as unknown as HTMLElement,
      player: PLAYER,
      authenticated: true,
      tracking: false,
      spectatorMode: "off" as const,
    };

    renderAdminPlayerActions(input);
    const initialGroup = actions.children[0];
    const initialGod = modeElements(actions)[0];
    renderAdminPlayerActions({ ...input, tracking: true });

    expect(actions.children[0]).not.toBe(initialGroup);
    const updatedGod = modeElements(actions)[0]; expect(updatedGod?.dataset.adminAction).toBe("god-on");
    expect(updatedGod).not.toBe(initialGod);
  });
});
function modeControl(label: string, action: string, state: string): string { return `${label}:${action}:${state}`; }
function modeControls(actions: TestElement): string[] { return modeElements(actions).map((control) => modeControl(
    control.children[0]?.textContent ?? "",
    control.dataset.adminAction ?? "",
    control.children[1]?.textContent ?? "",
  ));
}
function modeElements(actions: TestElement): TestElement[] {
  return actions.children.flatMap((group) => group.children).filter((control) => control.dataset.adminAction !== undefined).filter((control) => ["god-on", "god-off", "handicap-on", "handicap-off", "admin-on", "admin-off"].includes(control.dataset.adminAction ?? ""));
}
