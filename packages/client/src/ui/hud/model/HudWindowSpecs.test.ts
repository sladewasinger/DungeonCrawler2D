import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hudWindowSpecs, type HudWindowContents } from "./HudWindowSpecs.js";

const coreStyles = readFileSync(
  new URL("../styles/core.css", import.meta.url),
  "utf8",
);
const statusStyles = readFileSync(
  new URL("../styles/status.css", import.meta.url),
  "utf8",
);

const contents = (): HudWindowContents => ({
  status: {} as HTMLElement,
  compass: {} as HTMLElement,
  buffs: {} as HTMLElement,
  hotbar: {} as HTMLElement,
  chat: {} as HTMLElement,
  weapon: {} as HTMLElement,
  party: {} as HTMLElement,
  telemetry: {} as HTMLElement,
  contacts: {} as HTMLElement,
  craft: {} as HTMLElement,
  stash: {} as HTMLElement,
  adminDebug: {} as HTMLElement,
});

describe("HUD window defaults", () => {
  const windows = hudWindowSpecs(contents());

  it("ships telemetry hidden but registered in HUD settings", () => {
    expect(windows.find(({ id }) => id === "three-telemetry")).toMatchObject({
      id: "three-telemetry",
      title: "World status",
      defaultVisible: false,
    });
  });

  it("registers admin overlays as an interactive persisted HUD window", () => {
    expect(windows.find(({ id }) => id === "admin-debug")).toMatchObject({
      title: "Admin overlays",
      anchor: "top-right",
      interactive: true,
      defaultVisible: true,
      initiallyAvailable: false,
    });
  });

  it("uses content-only chrome for effects and the active weapon", () => {
    const chromeById = Object.fromEntries(
      windows.map(({ id, chrome }) => [id, chrome ?? "standard"]),
    );
    expect(chromeById).toMatchObject({
      "three-buffs": "content-only",
      "three-weapon": "content-only",
    });
  });

  it("removes only panel chrome from content-only windows", () => {
    expect(coreStyles).toMatch(
      /\.hud-window--content-only \.hud-panel\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;/s,
    );
  });

  it("keeps status and minimap sizing responsive without pixel minimums", () => {
    const status = windows.find(({ id }) => id === "three-health");
    const minimap = windows.find(({ id }) => id === "three-compass");

    expect(status).not.toHaveProperty("minHeight");
    expect(status).toMatchObject({ intrinsicMinHeight: true });
    expect(minimap).toMatchObject({ aspectRatio: 1 });
    expect(minimap).not.toHaveProperty("minWidth");
    expect(minimap).not.toHaveProperty("minHeight");
    expect(statusStyles).toContain("min-height: min-content");
    expect(coreStyles).toMatch(
      /\.hud-window--intrinsic-height\s*\{[^}]*min-height:\s*min-content;/s,
    );
  });
});
