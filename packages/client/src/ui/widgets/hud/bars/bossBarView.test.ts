import { describe, expect, it } from "vitest";
import {
  resolveBossBar,
  resolveRemoteBossBar,
  type BossEntitySource,
} from "./bossBarView.js";

const WARDEN_ID = "warden-of-five";

describe("resolveBossBar", () => {
  it("returns null when no boss entity is in the list", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: "slime", hp: 10, maxHp: 10 }];
    expect(resolveBossBar(entities)).toBeNull();
  });

  it("picks the boss entity's hp/maxHp and its own name when present", () => {
    const entities: BossEntitySource[] = [
      { kind: "enemy", defId: "slime", hp: 10, maxHp: 10 },
      { kind: "enemy", defId: WARDEN_ID, name: "The Warden of Five", hp: 400, maxHp: 900 },
    ];
    expect(resolveBossBar(entities)).toEqual({ name: "The Warden of Five", hp: 400, maxHp: 900 });
  });

  it("falls back to a title-cased id when the boss carries no name", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: WARDEN_ID, hp: 1, maxHp: 1 }];
    expect(resolveBossBar(entities)?.name).toBe("Warden Of Five");
  });

  it("ignores a non-enemy entity that happens to carry the boss defId", () => {
    const entities: BossEntitySource[] = [{ kind: "player", defId: WARDEN_ID, hp: 1, maxHp: 1 }];
    expect(resolveBossBar(entities)).toBeNull();
  });

  it("returns null when the boss entity is missing hp fields", () => {
    const entities: BossEntitySource[] = [{ kind: "enemy", defId: WARDEN_ID }];
    expect(resolveBossBar(entities)).toBeNull();
  });

  it("scans live remote records without materializing a snapshot array", () => {
    const remotes = new Map([
      ["slime", { snap: { kind: "enemy", defId: "slime", hp: 10, maxHp: 10 } }],
      ["boss", { snap: { kind: "enemy", defId: WARDEN_ID, hp: 7, maxHp: 20 } }],
    ]);
    expect(resolveRemoteBossBar(remotes.values())).toEqual({
      name: "Warden Of Five",
      hp: 7,
      maxHp: 20,
    });
  });
});
