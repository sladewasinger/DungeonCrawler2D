import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminPageActionController } from "../commands/adminPageActionController.js";
import {
  createFreePanControl,
  configureFreePanToggle,
  FREE_PAN_ACTION,
} from "../map/adminMapFreePan.js";

const ARIA_CHECKED = "aria-checked";
const FREE_PAN_COMMAND = "map-free-camera";

class TestElement {
  readonly children: TestElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly classes = new Set<string>();
  readonly dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, EventListener[]>();
  readonly style = { cssText: "" };
  textContent = "";

  readonly classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
  };

  replaceChildren(...elements: TestElement[]): void {
    this.children.splice(0, this.children.length, ...elements);
  }

  append(...elements: TestElement[]): void {
    this.children.push(...elements);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  querySelector<T extends Element>(): T | null {
    return this as unknown as T;
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return true;
  }
}

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

describe("admin map free-pan toggle", () => {
  it.each([false, true])("renders the %s pressed state", (pressed) => {
    const control = new TestElement();

    configureFreePanToggle(control as unknown as HTMLButtonElement, pressed);

    expect(control.attributes.get("role")).toBe("switch");
    expect(control.attributes.get(ARIA_CHECKED)).toBe(String(pressed));
    expect(control.children[0]?.textContent).toBe("Free pan");
    expect(control.children[1]?.textContent).toBe(pressed ? "ON" : "OFF");
    expect(control.classes.has("toggle-switch")).toBe(true);
  });

  it("reverses the command and presentation on the second click", () => {
    const control = createFreePanControl() as unknown as TestElement;
    const transitions: boolean[] = [];
    const controller = new AdminPageActionController({
      connection: {} as never,
      view: { root: control } as never,
      spawnPlacement: { toggleFreeCamera: (enabled: boolean) => transitions.push(enabled) } as never,
      playerObserver: {} as never,
    });

    expect(FREE_PAN_ACTION[1]).toBe(FREE_PAN_COMMAND);
    expect(control.dataset.adminAction).toBe(FREE_PAN_COMMAND);
    expect(control.attributes.get(ARIA_CHECKED)).toBe("false");
    controller.send(FREE_PAN_COMMAND, control as unknown as HTMLButtonElement);
    expect(transitions).toEqual([true]);
    expect(control.attributes.get(ARIA_CHECKED)).toBe("true");
    expect(control.children[1]?.textContent).toBe("ON");
    controller.send(FREE_PAN_COMMAND, control as unknown as HTMLButtonElement);
    expect(transitions).toEqual([true, false]);
    expect(control.attributes.get(ARIA_CHECKED)).toBe("false");
    expect(control.children[1]?.textContent).toBe("OFF");
  });

  it("keeps scene editor camera actions delegated to placement", () => {
    const calls: string[] = [];
    const controller = new AdminPageActionController({
      connection: {} as never,
      view: { root: new TestElement() } as never,
      spawnPlacement: {
        zoom: (direction: string) => calls.push(`zoom:${direction}`),
        resetZoom: () => calls.push("reset"),
      } as never,
      playerObserver: {} as never,
    });
    controller.send("map-zoom-in", null);
    controller.send("map-zoom-out", null);
    controller.send("map-zoom-reset", null);
    expect(calls).toEqual(["zoom:in", "zoom:out", "reset"]);
  });
});
