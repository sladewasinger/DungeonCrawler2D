import { describe, expect, it } from "vitest";
import { resolveBossBar, type BossEntitySource } from "./bossBarView.js";

describe("resolveBossBar", () => {
  it("returns null when no boss entity is in the list", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: "slime", hp: 10, maxHp: 10 }];
    expect(resolveBossBar(entities)).toBeNull();
  });

  it("picks the boss entity's hp/maxHp and its own name when present", () => {
    const entities: BossEntitySource[] = [
      { kind: "enemy", defId: "slime", hp: 10, maxHp: 10 },
      { kind: "enemy", defId: "warden-of-five", name: "The Warden of Five", hp: 400, maxHp: 900 },
    ];
    expect(resolveBossBar(entities)).toEqual({ name: "The Warden of Five", hp: 400, maxHp: 900 });
  });

  it("falls back to a title-cased id when the boss carries no name", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: "warden-of-five", hp: 1, maxHp: 1 }];
    expect(resolveBossBar(entities)?.name).toBe("Warden Of Five");
  });

  it("ignores a non-enemy entity that happens to carry the boss defId", () => {
    const entities: BossEntitySource[] = [{ kind: "player", defId: "warden-of-five", hp: 1, maxHp: 1 }];
    expect(resolveBossBar(entities)).toBeNull();
  });

  it("returns null when the boss entity is missing hp fields", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: "warden-of-five" }];
    expect(resolveBossBar(entities)).toBeNull();
  });
});
