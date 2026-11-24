/** Data specs defining sprite-fitted enemy hurtboxes and directional melee attack arcs. */
import type { EntityKind } from "../aiSensing.js";

export interface HurtboxSpec {
  readonly offsetY: number;
  readonly rx: number;
  readonly ry: number;
}

export interface EntityAttackSpec {
  readonly forwardOffset: number;
  readonly originOffsetY: number;
  readonly range: number;
  readonly halfArcRad: number;
  readonly activeSec: number;
}

export const ENTITY_HURTBOX_SPECS: Readonly<Record<EntityKind, HurtboxSpec>> = {
  slime: { offsetY: -0.42, rx: 0.64, ry: 0.56 },
  "slime-dummy": { offsetY: -0.36, rx: 0.58, ry: 0.50 },
  dummy: { offsetY: -0.66, rx: 0.66, ry: 0.82 },
  "spar-dummy": { offsetY: -0.68, rx: 0.66, ry: 0.84 },
  wolf: { offsetY: -0.50, rx: 0.64, ry: 0.68 },
  boar: { offsetY: -0.46, rx: 0.68, ry: 0.62 },
  spider: { offsetY: -0.46, rx: 0.80, ry: 0.62 },
  goblin: { offsetY: -0.46, rx: 0.58, ry: 0.62 },
  skeleton: { offsetY: -0.70, rx: 0.56, ry: 0.86 },
  orc: { offsetY: -0.78, rx: 0.86, ry: 0.94 },
  bear: { offsetY: -0.70, rx: 0.80, ry: 0.86 },
  golem: { offsetY: -0.98, rx: 1.15, ry: 1.16 },
};

export const ENTITY_ATTACK_SPECS: Readonly<Record<EntityKind, EntityAttackSpec>> = {
  slime: { forwardOffset: 0.18, originOffsetY: -0.42, range: 0.76, halfArcRad: 0.58, activeSec: 0.16 },
  spider: { forwardOffset: 0.20, originOffsetY: -0.46, range: 0.88, halfArcRad: 0.55, activeSec: 0.15 },
  wolf: { forwardOffset: 0.22, originOffsetY: -0.50, range: 0.90, halfArcRad: 0.58, activeSec: 0.16 },
  boar: { forwardOffset: 0.22, originOffsetY: -0.46, range: 0.96, halfArcRad: 0.62, activeSec: 0.18 },
  goblin: { forwardOffset: 0.18, originOffsetY: -0.46, range: 1.04, halfArcRad: 0.68, activeSec: 0.17 },
  skeleton: { forwardOffset: 0.18, originOffsetY: -0.70, range: 1.10, halfArcRad: 0.68, activeSec: 0.18 },
  bear: { forwardOffset: 0.22, originOffsetY: -0.70, range: 1.18, halfArcRad: 0.78, activeSec: 0.20 },
  orc: { forwardOffset: 0.22, originOffsetY: -0.78, range: 1.28, halfArcRad: 0.78, activeSec: 0.20 },
  golem: { forwardOffset: 0.26, originOffsetY: -0.98, range: 1.38, halfArcRad: 0.85, activeSec: 0.24 },
  "spar-dummy": { forwardOffset: 0.18, originOffsetY: -0.68, range: 1.82, halfArcRad: 0.78, activeSec: 0.20 },
  dummy: { forwardOffset: 0.18, originOffsetY: -0.42, range: 0, halfArcRad: 0.5, activeSec: 0 },
  "slime-dummy": { forwardOffset: 0.18, originOffsetY: -0.42, range: 0, halfArcRad: 0.5, activeSec: 0 },
};
