import { DEFAULT_APPEARANCE, type ArmorEquipment } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  characterCacheKey, getCharacterPortraitUrl, invalidateCharacterCacheKey,
} from "../../render/character/characterSprites.js";
import { computeWeightedProgress } from "./bootPreloader.js";
import { LoadingScreen } from "./loadingScreen.js";

const EMPTY_ARMOR: ArmorEquipment = { head: null, chest: null, legs: null, feet: null, offhand: null };

interface MockElement {
  id: string;
  tagName: string;
  className: string;
  textContent: string;
  style: Record<string, string>;
  children: MockElement[];
  querySelector?: ((selector: string) => MockElement | null) | undefined;
  classList: {
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
    contains: (name: string) => boolean;
  };
  append: (...nodes: MockElement[]) => void;
  appendChild: (node: MockElement) => void;
  remove: () => void;
}

function makeMockElement(tag: string): MockElement {
  const classes = new Set<string>();
  const el: MockElement = {
    id: "", tagName: tag.toUpperCase(), className: "", textContent: "", style: {}, children: [],
    classList: {
      add: (...names) => { for (const n of names) classes.add(n); },
      remove: (...names) => { for (const n of names) classes.delete(n); },
      contains: (n) => classes.has(n),
    },
    append: (...nodes) => { el.children.push(...nodes); },
    appendChild: (node) => { el.children.push(node); },
    remove: () => {},
  };
  return el;
}

function createMockDom(onToDataUrl: () => void): {
  readonly doc: Document; readonly host: MockElement & HTMLElement; readonly fills: MockElement[]; readonly contextOpts: unknown[];
} {
  const fills: MockElement[] = [];
  const contextOpts: unknown[] = [];
  const fakeCtx = {
    imageSmoothingEnabled: false, fillStyle: "", fillRect: () => {},
    getImageData: (...args: number[]) => ({ data: new Uint8ClampedArray((args[2] ?? 0) * (args[3] ?? 0) * 4), width: args[2] ?? 0, height: args[3] ?? 0 }),
    putImageData: () => {},
  };
  const createElement = (tag: string): unknown => {
    if (tag === "canvas") {
      return {
        width: 0, height: 0,
        getContext: (_k: string, opts?: unknown) => { contextOpts.push(opts); return fakeCtx; },
        toDataURL: () => { onToDataUrl(); return "data:image/png;base64,MOCK"; },
      };
    }
    const el = makeMockElement(tag);
    Object.defineProperty(el, "className", {
      get: () => [...el.children.map(() => ""), el.id].filter(Boolean).join(""),
      set: (val: string) => { if (val === "ow-loading-fill") fills.push(el); },
    });
    return el;
  };
  const head = makeMockElement("head");
  const host = makeMockElement("div") as unknown as MockElement & HTMLElement;
  const doc = { createElement, getElementById: () => null, head } as unknown as Document;
  return { doc, host, fills, contextOpts };
}

describe("bootPreloader helpers", () => {
  it("clamps and interpolates weighted loading progress cleanly", () => {
    expect(computeWeightedProgress([0, 0.62], -0.5)).toBe(0);
    expect(computeWeightedProgress([0, 0.62], 0.5)).toBeCloseTo(0.31, 6);
    expect(computeWeightedProgress([0, 0.62], 2)).toBe(0.62);
    expect(computeWeightedProgress([0.66, 0.88], Number.NaN)).toBe(0.66);
    expect(computeWeightedProgress([0.66, 0.88], 0.5)).toBeCloseTo(0.77, 6);
  });

  it("caches headless hero portraits and invalidates them cleanly per cache key", () => {
    const prevDoc = globalThis.document;
    const prevImageData = (globalThis as { ImageData?: unknown }).ImageData;
    let dataUrlCalls = 0;
    const { doc, contextOpts } = createMockDom(() => { dataUrlCalls += 1; });
    (globalThis as { document?: Document }).document = doc;
    (globalThis as { ImageData?: unknown }).ImageData = class MockImageData {
      constructor(public readonly data: Uint8ClampedArray, public readonly width: number, public readonly height: number) {}
    };
    try {
      const heroA = { ...DEFAULT_APPEARANCE, hairStyle: "spiky" as const, hairColor: "teal" as const };
      invalidateCharacterCacheKey(characterCacheKey(heroA, EMPTY_ARMOR));
      const first = getCharacterPortraitUrl(heroA, EMPTY_ARMOR);
      const second = getCharacterPortraitUrl(heroA, EMPTY_ARMOR);
      expect(first).toBe("data:image/png;base64,MOCK");
      expect(second).toBe(first);
      expect(dataUrlCalls).toBe(1);
      expect(contextOpts.length).toBeGreaterThan(0);
      expect(contextOpts.every((o) => (o as { willReadFrequently?: boolean } | undefined)?.willReadFrequently === true)).toBe(true);

      invalidateCharacterCacheKey(characterCacheKey(heroA, EMPTY_ARMOR));
      getCharacterPortraitUrl(heroA, EMPTY_ARMOR);
      expect(dataUrlCalls).toBe(2);
    } finally {
      (globalThis as { document?: Document }).document = prevDoc;
      (globalThis as { ImageData?: unknown }).ImageData = prevImageData;
    }
  });

  it("keeps LoadingScreen progress monotonic and clamped within [0%, 100%]", () => {
    const prevDoc = globalThis.document;
    const { doc, host, fills } = createMockDom(() => {});
    (globalThis as { document?: Document }).document = doc;
    try {
      const screen = new LoadingScreen(host);
      const fill = fills[0]!;
      screen.setProgress(-0.2, "Starting");
      expect(fill.style.width).toBe("0%");
      screen.setProgress(0.8, "Baking hero");
      expect(fill.style.width).toBe("80%");
      screen.setProgress(0.3, "Out of order");
      expect(fill.style.width).toBe("80%");
      screen.setProgress(1.5, "Ready!");
      expect(fill.style.width).toBe("100%");
    } finally {
      (globalThis as { document?: Document }).document = prevDoc;
    }
  });

  it("adopts pre-rendered #ow-boot-loading DOM and clears indeterminate shimmer on progress", () => {
    const prevDoc = globalThis.document;
    const { doc, host } = createMockDom(() => {});
    const existingRoot = makeMockElement("div");
    const fillEl = makeMockElement("div");
    const statusEl = makeMockElement("span");
    const pctEl = makeMockElement("span");
    fillEl.classList.add("ow-loading-indeterminate");
    const selectors: Record<string, MockElement> = {
      ".ow-loading-fill": fillEl,
      ".ow-loading-status": statusEl,
      ".ow-loading-pct": pctEl,
    };
    existingRoot.querySelector = (sel: string) => selectors[sel] ?? null;
    (doc as { getElementById: (id: string) => unknown }).getElementById = (id: string) => (
      id === "ow-boot-loading" ? existingRoot : null
    );
    (globalThis as { document?: Document }).document = doc;
    try {
      const screen = new LoadingScreen(host);
      expect(host.children).toHaveLength(0);
      screen.setProgress(0.42, "Fetching sprites...");
      expect(fillEl.classList.contains("ow-loading-indeterminate")).toBe(false);
      expect(fillEl.style.width).toBe("42%");
      expect(statusEl.textContent).toBe("Fetching sprites...");
      expect(pctEl.textContent).toBe("42%");
    } finally {
      (globalThis as { document?: Document }).document = prevDoc;
    }
  });
});
