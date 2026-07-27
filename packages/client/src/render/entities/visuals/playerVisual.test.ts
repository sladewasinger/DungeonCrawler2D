/** Verifies the live player visual forwards reconnect state into its rendered nameplate. */
import { describe, expect, it, vi } from "vitest";

const probes = vi.hoisted(() => ({
  heldWeapon: vi.fn(),
  nameplate: vi.fn(),
  screenTilePx: 64,
  nameplateGapPx: 4,
  nameplateLineHeightPx: 20,
  labelLineGapPx: 4,
  hpBarDisplayHeightPx: 14,
}));

vi.mock("../../boot/assetManifest.js", () => ({
  ASSET_KEYS: { atlas: "atlas" },
  SCREEN_TILE_PX: probes.screenTilePx,
  WORLD_PIXEL_SCALE: 1,
}));
vi.mock("../view/transform/viewState.js", () => ({ getViewOrientation: () => 0 }));
vi.mock("../view/transform/viewTransform.js", () => ({ worldAngleToView: (value: number) => value }));
vi.mock("./animState.js", () => ({ resolveAnimState: () => ({ animKey: "idle" }) }));
vi.mock("./heldWeapon.js", () => ({
  createHeldWeapon: vi.fn(),
  updateHeldWeapon: probes.heldWeapon,
}));
vi.mock("./hpBar.js", () => ({
  createHpBar: vi.fn(),
  HP_BAR_DISPLAY_HEIGHT_PX: probes.hpBarDisplayHeightPx,
  updateHpBar: vi.fn(),
}));
vi.mock("./hpBarVisibility.js", () => ({ resolveHpBarVisibility: () => false }));
vi.mock("./hitFlash.js", () => ({ flashIntensity: () => 0, tookDamage: () => false }));
vi.mock("./lift.js", () => ({ airborneHeightAboveGround: () => 0, spriteLiftPx: () => 0 }));
vi.mock("./nameplate.js", () => ({
  createNameplate: vi.fn(),
  LABEL_LINE_GAP_PX: probes.labelLineGapPx,
  NAMEPLATE_GAP_PX: probes.nameplateGapPx,
  NAMEPLATE_LINE_HEIGHT_PX: probes.nameplateLineHeightPx,
  updateNameplate: probes.nameplate,
}));
vi.mock("./occlusion.js", () => ({ syncOcclusionSilhouette: vi.fn(), terrainOcclusionAhead: () => false }));
vi.mock("./playerMotion.js", () => ({ inferPlayerAnimState: () => "idle", isRunningPace: () => false }));
vi.mock("./shadow.js", () => ({ createShadow: vi.fn(), updateShadowPosition: vi.fn() }));
vi.mock("./squash.js", () => ({ squashScale: () => ({ scaleX: 1, scaleY: 1 }) }));
vi.mock("./weaponIcon.js", () => ({
  FIST_FALLBACK_FRAME: "particle_soft",
  weaponIconFrame: () => null,
}));
vi.mock("./weaponOrbit.js", () => ({ stepOrbitAngle: () => 0 }));
vi.mock("./worldToScreen.js", () => ({
  combatOverlayPosition: () => ({ wielderViewY: 2, screenSouthFloorHigher: false }),
  depthForEntityNow: () => 1,
  depthForScreenY: () => 1,
  worldToScreen: (x: number, y: number) => ({ x, y }),
}));

function sprite() {
  const anims = { currentAnim: { key: "idle" }, timeScale: 1 };
  return {
    x: 0, y: 0, depth: 0, displayHeight: 16, anims,
    tint: null as number | null,
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    setDepth(depth: number) {
      this.depth = depth;
      return this;
    },
    setFlipX() { return this; },
    play() { return this; },
    setScale() { return this; },
    setTint(value: number) {
      this.tint = value;
      return this;
    },
    setTintFill(value: number) {
      this.tint = value;
      return this;
    },
    clearTint() {
      this.tint = null;
      return this;
    },
    setAngle() { return this; },
  };
}

describe("updatePlayerVisual", () => {
  it("updates remote reconnect state and preserves unarmed combat facing", async () => {
    const { updatePlayerVisual } = await import("./playerVisual.js");
    const body = sprite();
    const visual = {
      body, weapon: {}, shadow: { setDepth: vi.fn() }, hpBar: { container: { setDepth: vi.fn(), setVisible: vi.fn() } },
      nameplate: { setDepth: vi.fn() }, lastHp: 30, hpBarRevealed: false, hitFlashStartMs: undefined,
      lastX: 0, lastY: 0, lastSampleMs: 0, lastAir: false, squashStartMs: undefined,
      weaponAngle: 0, wasAttacking: false, swingStartMs: undefined,
    };
    const context = {
      nowMs: 10,
      dtSeconds: 0.016,
      selfX: 0,
      selfY: 0,
      partyIds: new Set(),
      world: { groundAt: () => 0, heightAt: () => 0, isWalkable: () => true },
    };
    const view = { id: "p", playerId: "p", name: "Wren", x: 1, y: 2, z: 0, hp: 30, maxHp: 30, fx: [], faceX: 1, faceY: 0, air: false, downed: false, disconnected: true, attacking: false, blocking: false, weaponId: null, weaponAimAngle: null, attackAngleRad: 0 };
    updatePlayerVisual({ visual: visual as never, skinPrefix: "hero", view, context: context as never });
    expect(body.tint).toBe(0x55555a);
    expect(probes.nameplate).toHaveBeenLastCalledWith(expect.anything(), "Wren", 1, -14 + probes.screenTilePx / 3, expect.any(Number), false, false, true);
    expect(probes.heldWeapon).toHaveBeenLastCalledWith(
      visual.weapon,
      "particle_soft",
      expect.objectContaining({ isFistFallback: true, orbitAngleRad: 0 }),
    );
    updatePlayerVisual({
      visual: visual as never,
      skinPrefix: "hero",
      view: { ...view, disconnected: false, blocking: true },
      context: context as never,
    });
    expect(body.tint).toBeNull();
    expect(probes.nameplate).toHaveBeenLastCalledWith(expect.anything(), "Wren", 1, -14 + probes.screenTilePx / 3, expect.any(Number), false, false, false);
    expect(probes.heldWeapon).toHaveBeenLastCalledWith(
      visual.weapon,
      "particle_soft",
      expect.objectContaining({
        blocking: true,
        isFistFallback: true,
        orbitAngleRad: 0,
      }),
    );
  });
});
