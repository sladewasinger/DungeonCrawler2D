import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const touchStyles = readFileSync(
  new URL("../styles/touch.css", import.meta.url),
  "utf8",
);

describe("touch action overlay routing", () => {
  it("lets action taps reach Phaser while the DOM-owned bag stays clickable", () => {
    expect(touchStyles).toMatch(
      /\.hud-touch__button\s*\{\s*pointer-events:\s*none;\s*\}/,
    );
    expect(touchStyles).toMatch(
      /\.hud-touch__bag\s*\{\s*pointer-events:\s*auto;\s*\}/,
    );
  });
});
