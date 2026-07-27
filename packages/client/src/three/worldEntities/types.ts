import type { InterpolatedEntity } from "../../net/interpolate.js";
import type { ThreeEntityPresentation } from "../threeEntityPresentation.js";
import type { ThreeTextSprite } from "../ThreeTextSprite.js";

export interface RenderObject {
  position: { set(x: number, y: number, z: number): void };
  rotation: { y: number };
  scale: { setScalar(value: number): void };
  add(...objects: unknown[]): void;
  traverse(callback: (object: RenderNode) => void): void;
  removeFromParent(): void;
}

export interface RenderNode {
  geometry?: { dispose(): void };
  material?: { dispose(): void } | Array<{ dispose(): void }>;
}

export interface ActiveEntity {
  object: RenderObject;
  presentation: ThreeEntityPresentation;
  phase: number;
  label?: ThreeTextSprite;
  timer?: ThreeTextSprite;
  timerText?: string;
}

export interface WorldEntityUpdate {
  readonly interpolated: readonly InterpolatedEntity[];
  readonly timeMs: number;
  readonly reducedMotion: boolean;
  readonly serverTick: number;
  readonly self: { readonly x: number; readonly y: number };
}

export interface LootLabelUpdate {
  readonly entity: ActiveEntity;
  readonly presentation: ThreeEntityPresentation;
  readonly source: InterpolatedEntity;
  readonly serverTick: number;
  readonly self: { readonly x: number; readonly y: number };
}

export interface TransformUpdate {
  readonly entity: ActiveEntity;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly time: number;
}

export const phaseFor = (id: string): number => {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 628) / 100;
};
