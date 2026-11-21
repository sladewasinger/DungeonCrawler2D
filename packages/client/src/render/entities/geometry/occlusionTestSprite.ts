import { vi } from "vitest";
import type Phaser from "phaser";

export interface FakeOcclusionSpritePair {
  readonly body: Phaser.GameObjects.Sprite;
  readonly ghost: Phaser.GameObjects.Sprite;
  readonly addSprite: ReturnType<typeof vi.fn>;
}

interface FakeSpriteOptions {
  readonly textureKey: string;
  readonly frameName: string;
  readonly existingGhost?: Phaser.GameObjects.Sprite;
  readonly addSprite?: ReturnType<typeof vi.fn>;
}

export function fakeOcclusionSpritePair(textureKey: string, frameName: string): FakeOcclusionSpritePair {
  const ghost = fakeSprite({ textureKey: "", frameName: "" });
  const addSprite = vi.fn(() => ghost);
  const body = fakeSprite({ textureKey, frameName, addSprite });
  return { body, ghost, addSprite };
}

function fakeSprite(options: FakeSpriteOptions): Phaser.GameObjects.Sprite {
  return createSprite(options);
}

function createSprite(options: FakeSpriteOptions): Phaser.GameObjects.Sprite {
  const { textureKey, frameName, existingGhost, addSprite = vi.fn() } = options;
  const sprite: Record<string, unknown> = {
    texture: { key: textureKey },
    frame: { name: frameName, width: 24, height: 24 },
    x: 100,
    y: 100,
    displayHeight: 24,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    angle: 0,
    scene: { add: { sprite: addSprite } },
    ...spriteDataMethods(existingGhost),
  };
  return sprite as unknown as Phaser.GameObjects.Sprite;
}

function spriteDataMethods(existingGhost?: Phaser.GameObjects.Sprite): Record<string, unknown> {
  return {
    getData: vi.fn(() => existingGhost),
    setData: vi.fn(),
    once: vi.fn(),
    setPosition: vi.fn(function setPosition(this: Record<string, unknown>, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    setTexture: vi.fn(function setTexture(this: Record<string, unknown>, key: string, name: string) {
      this.texture = { key }; this.frame = { name, width: 24, height: 24 }; return this;
    }),
    setFlipX: vi.fn(function setFlipX(this: Record<string, unknown>, value: boolean) {
      this.flipX = value; return this;
    }),
    setScale: vi.fn(function setScale(this: Record<string, unknown>, x: number, y = x) {
      this.scaleX = x; this.scaleY = y; return this;
    }),
    setAngle: vi.fn(function setAngle(this: Record<string, unknown>, value: number) {
      this.angle = value; return this;
    }),
    setCrop: vi.fn(),
    setVisible: vi.fn(),
    setDepth: vi.fn(),
    setOrigin: vi.fn(function setOrigin(this: Record<string, unknown>) { return this; }),
    setTint: vi.fn(),
    setTintMode: vi.fn(),
    setAlpha: vi.fn(),
  };
}
