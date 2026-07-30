import { describe, expect, it } from "vitest";
import {
  isCacheableImmutableAssetResponse,
  isCacheableResponse,
  isGameShellNavigation,
  isImmutableAssetRequest,
  isImmutableAssetUrl,
} from "./assetCaching.js";

const GAME_ORIGIN = "https://game.invalid";

describe("service-worker asset caching", () => {
  it("caches Vite content-addressed bundles immutably", () => {
    expect(isImmutableAssetUrl(new URL("https://game.invalid/assets/main-Ab12cd34.js")))
      .toBe(true);
  });

  it("caches build-versioned public assets immutably", () => {
    const assetUrls = [
      "https://game.invalid/assets/atlas.png?build=abc1234",
      "https://game.invalid/assets/particles/particle-atlas.json?build=abc1234",
      "https://game.invalid/assets/fonts/monogram.ttf?build=abc1234",
    ];

    for (const assetUrl of assetUrls) {
      expect(isImmutableAssetUrl(new URL(assetUrl))).toBe(true);
    }
  });

  it("does not treat build-versioned application state as immutable", () => {
    expect(isImmutableAssetUrl(new URL("https://game.invalid/state.json?build=x")))
      .toBe(false);
  });

  it("does not treat mutable fixed-name assets as immutable", () => {
    expect(isImmutableAssetUrl(new URL("https://game.invalid/assets/atlas.png")))
      .toBe(false);
    expect(isImmutableAssetUrl(new URL("https://game.invalid/assets/atlas.json")))
      .toBe(false);
  });

  it("only treats same-origin GET requests as immutable assets", () => {
    const url = "https://game.invalid/assets/main-Ab12cd34.js";

    expect(isImmutableAssetRequest(new Request(url), GAME_ORIGIN))
      .toBe(true);
    expect(isImmutableAssetRequest(
      new Request(url, { method: "POST" }),
      GAME_ORIGIN,
    )).toBe(false);
    expect(isImmutableAssetRequest(
      new Request("https://cdn.invalid/assets/main-Ab12cd34.js"),
      GAME_ORIGIN,
    )).toBe(false);
  });

  it("only identifies the same-origin game shell navigations", () => {
    expect(isGameShellNavigation(new Request(`${GAME_ORIGIN}/`), GAME_ORIGIN))
      .toBe(true);
    expect(isGameShellNavigation(
      new Request(`${GAME_ORIGIN}/index.html?from=bookmark`),
      GAME_ORIGIN,
    )).toBe(true);
    expect(isGameShellNavigation(
      new Request(`${GAME_ORIGIN}/releases/index.html`),
      GAME_ORIGIN,
    )).toBe(false);
    expect(isGameShellNavigation(
      new Request(`${GAME_ORIGIN}/dungeon`),
      GAME_ORIGIN,
    )).toBe(false);
    expect(isGameShellNavigation(
      new Request(`${GAME_ORIGIN}/`, { method: "POST" }),
      GAME_ORIGIN,
    )).toBe(false);
  });

  it("only permits successful cache-compatible responses", () => {
    expect(isCacheableResponse(new Response("asset"))).toBe(true);
    expect(isCacheableResponse(new Response("missing", { status: 404 })))
      .toBe(false);
    expect(isCacheableResponse(new Response("partial", { status: 206 })))
      .toBe(false);
    expect(isCacheableResponse(new Response("vary", {
      headers: { Vary: "*" },
    }))).toBe(false);
  });

  it("rejects an HTML rewrite for an immutable JavaScript asset", () => {
    const request = new Request(
      `${GAME_ORIGIN}/assets/main-Ab12cd34.js`,
    );
    const rewrittenShell = new Response("<html>game shell</html>", {
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    expect(isCacheableImmutableAssetResponse(request, rewrittenShell))
      .toBe(false);
  });

  it("accepts the expected content type for each immutable asset extension", () => {
    const assets = [
      ["main-Ab12cd34.js", "text/javascript; charset=utf-8"],
      ["main-Ab12cd34.css", "text/css; charset=utf-8"],
      ["atlas.json", "application/json"],
      ["atlas.png", "image/png"],
      ["monogram.ttf", "font/ttf"],
    ] as const;

    for (const [asset, contentType] of assets) {
      const request = new Request(`${GAME_ORIGIN}/assets/${asset}?build=x`);
      const response = new Response("asset", {
        headers: { "content-type": contentType },
      });
      expect(isCacheableImmutableAssetResponse(request, response)).toBe(true);
    }
  });
});
