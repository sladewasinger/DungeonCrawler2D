import type Phaser from "phaser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetViewOrientation } from "../../../view/transform/viewState.js";
import type { PetEntityView } from "../../visuals/view.js";
import {
  createDinoBehaviorVisual,
  syncDinoBehaviorVisual,
} from "./dinoBehaviorVisual.js";
import {
  TARD_FART_DURATION_MS,
  TARD_FART_PARTICLE_COUNT,
  tardRearwardVelocity,
} from "./dinos/tard.js";

afterEach(resetViewOrientation);

describe("dino behavior visuals", () => {
  it("leaves dinos without a registered behavior unchanged", () => {
    const behavior = createDinoBehaviorVisual({} as Phaser.Scene, "pet-dino-mort");
    const body = { x: 12, y: 28, depth: 4 } as unknown as Phaser.GameObjects.Sprite;

    syncDinoBehaviorVisual({
      behavior,
      body,
      nowMs: 100,
      view: petView(),
    });

    expect(body).toMatchObject({ x: 12, y: 28, depth: 4 });
    expect(behavior.destroy()).toBeUndefined();
  });

  it("applies each replicated Tard toot event once", () => {
    const emitter = fakeEmitter();
    const particles = vi.fn(() => emitter);
    const scene = { add: { particles } } as unknown as Phaser.Scene;
    const behavior = createDinoBehaviorVisual(scene, "pet-dino-tard");
    const body = { depth: 4 } as unknown as Phaser.GameObjects.Sprite;
    const input = {
      behavior,
      body,
      nowMs: 100,
      view: petView({ petBehavior: "toot", petBehaviorEvent: 1 }),
    };

    syncDinoBehaviorVisual(input);
    syncDinoBehaviorVisual(input);

    expect(emitter.explode).toHaveBeenCalledTimes(1);
    expect(emitter.explode).toHaveBeenCalledWith(TARD_FART_PARTICLE_COUNT);
    expect(emitter.setDepth).toHaveBeenCalledWith(4.08);
    expect(emitter.setVisible).toHaveBeenCalledWith(true);
    expect(emitter.setRadial).toHaveBeenCalledWith(false);
    expect(emitter.setParticleSpeed).toHaveBeenCalledWith(-44, 0);
    expect(emitter.setParticleSpeed.mock.invocationCallOrder[0]).toBeLessThan(
      emitter.setRadial.mock.invocationCallOrder[0] ?? Infinity,
    );
    expect(particles).toHaveBeenCalledWith(0, 0, "atlas", expect.objectContaining({
      lifespan: TARD_FART_DURATION_MS,
      quantity: TARD_FART_PARTICLE_COUNT,
      scale: { start: 1.35, end: 0.22, random: true },
    }));
  });

  it("projects the rearward ejection vector through every camera rotation", () => {
    const expected = [
      [0, { x: -44, y: 0 }],
      [90, { x: 0, y: 44 }],
      [180, { x: 44, y: 0 }],
      [270, { x: 0, y: -44 }],
    ] as const;
    for (const [orientation, velocity] of expected) {
      expect(tardRearwardVelocity({
        faceX: 1,
        faceY: 0,
        orientation,
      })).toEqual(velocity);
    }
  });
});

function petView(overrides: Partial<PetEntityView> = {}): PetEntityView {
  return {
    x: 3,
    y: 5,
    faceX: 1,
    faceY: 0,
    petBehavior: "idle",
    petBehaviorEvent: 0,
    ...overrides,
  } as PetEntityView;
}

interface FakeEmitter {
  readonly setPosition: ReturnType<typeof vi.fn>;
  readonly setDepth: ReturnType<typeof vi.fn>;
  readonly setVisible: ReturnType<typeof vi.fn>;
  readonly setActive: ReturnType<typeof vi.fn>;
  readonly setRadial: ReturnType<typeof vi.fn>;
  readonly setParticleSpeed: ReturnType<typeof vi.fn>;
  readonly killAll: ReturnType<typeof vi.fn>;
  readonly explode: ReturnType<typeof vi.fn>;
  readonly destroy: ReturnType<typeof vi.fn>;
}

function fakeEmitter(): FakeEmitter {
  const emitter: FakeEmitter = {
    setPosition: vi.fn(),
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    setActive: vi.fn(),
    setRadial: vi.fn(),
    setParticleSpeed: vi.fn(),
    killAll: vi.fn(),
    explode: vi.fn(),
    destroy: vi.fn(),
  };
  emitter.setPosition.mockReturnValue(emitter);
  emitter.setDepth.mockReturnValue(emitter);
  emitter.setVisible.mockReturnValue(emitter);
  emitter.setActive.mockReturnValue(emitter);
  emitter.setRadial.mockReturnValue(emitter);
  emitter.setParticleSpeed.mockReturnValue(emitter);
  return emitter;
}
