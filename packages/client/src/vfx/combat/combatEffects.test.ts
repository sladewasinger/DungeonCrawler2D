import type Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  bone: vi.fn(),
  decal: vi.fn(),
  deathBlood: vi.fn(),
  hitBlood: vi.fn(),
}));

vi.mock("../../render/entities/geometry/worldToScreen.js", () => ({
  worldToScreen: (x: number, y: number) => ({ x, y }),
}));
vi.mock("../death/boneChipBurst.js", () => ({
  isSkeletalDefId: (id: string | undefined) =>
    id === "skeleton" || id === "warden-of-five",
  spawnBoneChipBurst: probes.bone,
}));
vi.mock("../blood/bloodDecalPool.js", () => ({
  BloodDecalPool: class {
    spawn = probes.decal;
    update() {}
    dispose() {}
  },
}));
vi.mock("../blood/bloodSplatter.js", () => ({
  spawnDeathSplatter: probes.deathBlood,
  spawnHitSplatter: probes.hitBlood,
}));
vi.mock("../blood/bloodTint.js", () => ({ bloodTintFor: () => 0xe04a4a }));
vi.mock("../system/carnageSettings.js", () => ({
  loadCarnageSettings: () => ({
    enabled: true,
    bloodEnabled: true,
    bloodDropIntensity: 1,
  }),
}));
vi.mock("../death/corpseDecalPool.js", () => ({
  CorpseDecalPool: class {
    spawn() {}
    update() {}
    dispose() {}
  },
}));
vi.mock("../death/deathCarnagePool.js", () => ({
  DeathCarnagePool: class {
    spawn() {}
    update() {}
    dispose() {}
  },
}));
vi.mock("../death/gibBurst.js", () => ({ spawnGibBurst: vi.fn() }));
vi.mock("../particles/screenShake.js", () => ({
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
    effects.spawnBloodHit({ x: 2, y: 3, groundHeight: 0, defId: "skeleton", nowMs: 100, direction: { x: 1, y: 0 } });
    expect(probes.bone).toHaveBeenCalledWith(expect.anything(), {
      x: 2,
      y: 3,
      lethal: false,
      direction: { x: 1, y: 0 },
    });
    expect(probes.hitBlood).not.toHaveBeenCalled();
    expect(probes.decal).not.toHaveBeenCalled();
  });

  it("uses a larger bone burst without blood on a lethal hit", async () => {
    const { CombatEffects } = await import("./combatEffects.js");
    const effects = new CombatEffects({
      cameras: { main: {} },
    } as Phaser.Scene);
    effects.spawnBloodDeath({ x: 2, y: 3, groundHeight: 0, defId: "warden-of-five", nowMs: 100 });
    expect(probes.bone).toHaveBeenCalledWith(expect.anything(), {
      x: 2,
      y: 3,
      lethal: true,
    });
    expect(probes.deathBlood).not.toHaveBeenCalled();
    expect(probes.decal).not.toHaveBeenCalled();
  });
});
