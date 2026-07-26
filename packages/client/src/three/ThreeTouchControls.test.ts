import { afterEach, describe, expect, it, vi } from "vitest";
import { InputModalityStore } from "../input/inputModality.js";
import { ThreeTouchControls } from "./ThreeTouchControls.js";

class FakeElement {
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  private parent: FakeElement | null = null;
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  type = "";
  textContent = "";

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  setPointerCapture(): void {}
  hasPointerCapture(): boolean { return false; }
  releasePointerCapture(): void {}

  getBoundingClientRect(): DOMRect {
    return {
      left: 0, right: 800, top: 0, bottom: 600,
      width: 800, height: 600, x: 0, y: 0,
      toJSON: () => ({}),
    };
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThreeTouchControls modality parity", () => {
  it("mounts once per touch phase, unmounts on desktop, and unsubscribes", () => {
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", {
      createElement: () => new FakeElement(),
    });
    const root = new FakeElement();
    const store = new InputModalityStore("desktop");
    const controls = new ThreeTouchControls(
      root as unknown as HTMLElement,
      store,
    );

    expect(controls.active).toBe(false);
    expect(root.children).toHaveLength(0);
    store.noteTouch(10);
    store.noteTouch(20);
    expect(controls.active).toBe(true);
    expect(root.children).toHaveLength(1);

    store.noteDesktop("keyboard", 21);
    expect(controls.active).toBe(false);
    expect(root.children).toHaveLength(0);
    expect(controls.read(1)).toMatchObject({
      forward: 0,
      right: 0,
      jump: false,
      attack: false,
      interactHeld: false,
    });

    controls.dispose();
    store.noteTouch(30);
    expect(controls.active).toBe(false);
  });
});
