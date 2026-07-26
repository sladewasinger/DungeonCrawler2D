import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  bone: vi.fn(),
  decal: vi.fn(),
  deathBlood: vi.fn(),
  hitBlood: vi.fn(),
}));

vi.mock("../render/entities/worldToScreen.js", () => ({
  worldToScreen: (x: number, y: number) => ({ x, y }),
}));
vi.mock("./boneChipBurst.js", () => ({
  isSkeletalDefId: (id: string | undefined) =>
    id === "skeleton" || id === "warden-of-five",
  spawnBoneChipBurst: probes.bone,
}));
vi.mock("./bloodDecalPool.js", () => ({
  BloodDecalPool: class {
    spawn = probes.decal;
    update() {}
    dispose() {}
  },
}));
vi.mock("./bloodSplatter.js", () => ({
  spawnDeathSplatter: probes.deathBlood,
  spawnHitSplatter: probes.hitBlood,
}));
vi.mock("./bloodTint.js", () => ({ bloodTintFor: () => 0xe04a4a }));
vi.mock("./carnageSettings.js", () => ({
  loadCarnageSettings: () => ({
    enabled: true,
    bloodEnabled: true,
    bloodDropIntensity: 1,
  }),
}));
vi.mock("./corpseDecalPool.js", () => ({
  CorpseDecalPool: class {
    spawn() {}
    update() {}
    dispose() {}
  },
}));
vi.mock("./deathCarnagePool.js", () => ({
  DeathCarnagePool: class {
    spawn() {}
    update() {}
    dispose() {}
  },
}));
vi.mock("./gibBurst.js", () => ({ spawnGibBurst: vi.fn() }));
vi.mock("./screenShake.js", () => ({
  ScreenShakeBudget: class {
    onKillMoment() {}
    onOwnHit() {}
    onOwnDeath() {}
  },
}));
vi.mock("./hitStop.js", () => ({
  HIT_STOP_DURATION_MS: 60,
  HIT_STOP_ZOOM: 1.04,
}));

describe("CombatEffects skeletal impacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses bone chips without blood particles or decals on a hit", async () => {
    const { CombatEffects } = await import("./combatEffects.js");
    const effects = new CombatEffects({
      cameras: { main: {} },
    } as Phaser.Scene);
    effects.spawnBloodHit(2, 3, 0, "skeleton", 100, 1, 0);
    expect(probes.bone).toHaveBeenCalledWith(
      expect.anything(), 2, 3, false, 1, 0,
    );
    expect(probes.hitBlood).not.toHaveBeenCalled();
    expect(probes.decal).not.toHaveBeenCalled();
  });

  it("uses a larger bone burst without blood on a lethal hit", async () => {
    const { CombatEffects } = await import("./combatEffects.js");
    const effects = new CombatEffects({
      cameras: { main: {} },
    } as Phaser.Scene);
    effects.spawnBloodDeath(2, 3, 0, "warden-of-five", 100);
    expect(probes.bone).toHaveBeenCalledWith(
      expect.anything(), 2, 3, true,
    );
    expect(probes.deathBlood).not.toHaveBeenCalled();
    expect(probes.decal).not.toHaveBeenCalled();
  });
});
