import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeElement {
  textContent: string;
  children: FakeElement[];
  click(): void;
  append(...children: FakeElement[]): void;
}

const controls = vi.hoisted(() => ({
  actions: new Map<string, () => void>(),
}));

vi.mock("../SessionMenuControls.js", () => ({
  createSessionButton: (label: string, action: () => void) => {
    controls.actions.set(label, action);
    return fakeElement(label);
  },
}));

vi.mock("../../hud/styles/hudTemplate.js", () => ({
  createHudTemplate: () => fakeElement(),
}));

beforeEach(() => controls.actions.clear());

describe("session menu primary actions", () => {
  it("shows an I'm stuck button wired to the rescue action", async () => {
    const { buildSessionMenuPrimary } = await import("../SessionMenuPrimary.js");
    const container = fakeElement();
    const rescue = vi.fn();
    buildSessionMenuPrimary({
      container: container as unknown as HTMLElement,
      respawnButton: fakeElement("Respawn") as unknown as HTMLButtonElement,
      settingsContent: fakeElement("Settings") as unknown as HTMLElement,
      onResume: vi.fn(),
      onRescue: rescue,
      onQuit: vi.fn(),
      onAdvanced: vi.fn(),
    });

    const button = container.children.find(({ textContent }) => textContent === "I'm stuck");
    expect(button).toBeDefined();
    button?.click();
    expect(rescue).toHaveBeenCalledOnce();
  });
});

function fakeElement(textContent = ""): FakeElement {
  return {
    textContent,
    children: [],
    click() {
      controls.actions.get(this.textContent)?.();
    },
    append(...children) {
      this.children.push(...children);
    },
  };
}
