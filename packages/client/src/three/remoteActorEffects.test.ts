import { describe, expect, it } from "vitest";
import { remoteActorEffects } from "./remoteActorEffects.js";

describe("remote actor effects", () => {
  it("distinguishes blocking, damage, and positive effects", () => {
    const block = remoteActorEffects([], true);
    const bleed = remoteActorEffects(["bleeding"]);
    const heal = remoteActorEffects(["bandaged"]);
    expect(new Set([block.color, bleed.color, heal.color]).size).toBe(3);
  });

  it("keeps downed state dominant and hides an inactive aura", () => {
    expect(remoteActorEffects(["bandaged"], true, true).color).toBe("#b94a58");
    expect(remoteActorEffects()).toMatchObject({ visible: false, opacity: 0 });
  });
});
