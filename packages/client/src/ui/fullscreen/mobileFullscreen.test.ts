/** Verifies standard, WebKit, and post-resume fullscreen behavior. */
import { describe, expect, it } from "vitest";
import { canEnterFullscreen, enterFullscreenLandscape, installFullscreenResumeRetry, isFullscreenActive } from "./mobileFullscreen.js";

type Listener = () => void;

function fakeDocument(options: { standard?: boolean; webkit?: boolean; active?: "standard" | "webkit"; enabled?: boolean } = {}) {
  const listeners = new Map<string, Listener>();
  const target = {
    requestFullscreen: options.standard ? (() => Promise.resolve()) : undefined,
    webkitRequestFullscreen: options.webkit ? (() => Promise.resolve()) : undefined,
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  const doc = {
    fullscreenEnabled: options.enabled ?? true,
    fullscreenElement: options.active === "standard" ? target : null,
    ...(options.active === "webkit" ? { webkitFullscreenElement: target } : {}),
    documentElement: target,
    visibilityState: "hidden",
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
    emit: (type: string) => listeners.get(type)?.(),
  };
  return { doc, target, emitTarget: (type: string) => listeners.get(type)?.() };
}

function asElement(value: object): HTMLElement {
  return value as HTMLElement;
}

function asDocument(value: object): Document {
  return value as Document;
}

function asScreen(value: object): Screen {
  return value as Screen;
}

describe("mobile fullscreen", () => {
  it("treats an inactive standard-only document as not fullscreen", () => {
    expect(isFullscreenActive(asDocument({ fullscreenElement: null }))).toBe(false);
  });

  it("uses the standard API and locks landscape after the request", async () => {
    const { doc, target } = fakeDocument({ standard: true });
    let requests = 0;
    let locks = 0;
    target.requestFullscreen = () => {
      requests += 1;
      return Promise.resolve();
    };
    const result = await enterFullscreenLandscape(asElement(target), asDocument(doc), asScreen({ orientation: { lock: async () => { locks += 1; } } }));
    expect(result).toBe(true);
    expect(requests).toBe(1);
    expect(locks).toBe(1);
  });

  it("supports webkit fullscreen and detects existing fullscreen", async () => {
    const { doc, target } = fakeDocument({ webkit: true, active: "webkit" });
    let requests = 0;
    target.webkitRequestFullscreen = () => {
      requests += 1;
      return Promise.resolve();
    };
    expect(canEnterFullscreen(asElement(target), asDocument(doc))).toBe(true);
    expect(isFullscreenActive(asDocument(doc))).toBe(true);
    await expect(enterFullscreenLandscape(asElement(target), asDocument(doc), asScreen({}))).resolves.toBe(true);
    expect(requests).toBe(0);
  });

  it("uses WebKit fullscreen when the standard API is disabled", async () => {
    const { doc, target } = fakeDocument({ webkit: true, enabled: false });
    let requests = 0;
    target.webkitRequestFullscreen = () => {
      requests += 1;
      return Promise.resolve();
    };
    expect(canEnterFullscreen(asElement(target), asDocument(doc))).toBe(true);
    await expect(enterFullscreenLandscape(asElement(target), asDocument(doc), asScreen({}))).resolves.toBe(true);
    expect(requests).toBe(1);
  });

  it("arms exactly one unmodified game tap after a mobile return", async () => {
    const { doc, target, emitTarget } = fakeDocument({ standard: true });
    let requests = 0;
    target.requestFullscreen = () => {
      requests += 1;
      return Promise.resolve();
    };
    const retry = installFullscreenResumeRetry(asElement(target), asDocument(doc), asScreen({}), true);
    (doc as unknown as { visibilityState: string }).visibilityState = "visible";
    (doc as unknown as { emit(type: string): void }).emit("visibilitychange");
    emitTarget("pointerdown");
    await Promise.resolve();
    expect(requests).toBe(1);
    retry.dispose();
    emitTarget("pointerdown");
    expect(requests).toBe(1);
  });
});
