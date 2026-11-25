/** Pure VFX specs for combat feedback world events (parry, guardBreak, riposte, slam, burn, stealth). */
import { GroundKind, type WorldEvent } from "@dc2d/engine";

export interface FeedbackCueSpec {
  readonly style: "burst" | "ring" | "popup";
  readonly color: number;
  readonly radius?: number;
  readonly text: string;
  readonly textOffsetY?: number;
  readonly hitstopSec?: number;
}

const STATIC_CUES: Partial<Record<WorldEvent["kind"], FeedbackCueSpec>> = {
  block: { style: "burst", color: 0x93c5fd, radius: 9, text: "BLOCK" },
  arrowRicochet: { style: "burst", color: 0xfde047, radius: 7, text: "" },
  wolfHowl: { style: "ring", color: 0x7dd3fc, radius: 18, text: "" },
  bearBluff: { style: "ring", color: 0xf97316, radius: 17, text: "ROAR!" },
  boarCrash: { style: "burst", color: 0xfde047, radius: 14, text: "CRASH!" },
  ambushShot: { style: "burst", color: 0xfde047, radius: 13, text: "AMBUSH!", textOffsetY: -1.6 },
  backstab: { style: "burst", color: 0xfacc15, radius: 13, text: "BACKSTAB!", textOffsetY: -1.6, hitstopSec: 0.065 },
  bedSet: { style: "popup", color: 0x4ade80, text: "RESPAWN SET!", textOffsetY: -1.1 },
  guardBreak: { style: "burst", color: 0xf97316, radius: 14, text: "GUARD BREAK!", textOffsetY: -1.6, hitstopSec: 0.06 },
  riposte: { style: "burst", color: 0xfef08a, radius: 15, text: "RIPOSTE!", textOffsetY: -1.7, hitstopSec: 0.075 },
  heavyCharge: { style: "ring", color: 0xfde047, radius: 10, text: "" },
  slamImpact: { style: "ring", color: 0xd6d3d1, radius: 16, text: "", hitstopSec: 0.06 },
  burnExtinguish: { style: "popup", color: 0x7dd3fc, text: "DOUSED", textOffsetY: -0.95 },
  webCut: { style: "burst", color: 0xe2e8f0, radius: 9, text: "" },
  cocoonWrap: { style: "ring", color: 0xf1f5f9, radius: 13, text: "COCOONED!" },
  cocoonBreak: { style: "burst", color: 0x86efac, radius: 15, text: "FREED!", textOffsetY: -1.4 },
};

const DYNAMIC_CUE_BUILDERS: Partial<Record<WorldEvent["kind"], (ev: WorldEvent) => FeedbackCueSpec>> = {
  heal: (ev) => ({ style: "popup", color: 0x4ade80, text: `+${Math.round(ev.value ?? 20)}`, textOffsetY: -0.9 }),
  burnTick: (ev) => ({ style: "popup", color: 0xf97316, text: `-${Math.round(ev.value ?? 4)}`, textOffsetY: -0.9 }),
  poisonTick: (ev) => ({ style: "popup", color: 0x4ade80, text: `-${Math.round(ev.value ?? 3)}`, textOffsetY: -0.9 }),
  pebbleLand: (ev) => {
    const water = ev.value === GroundKind.ShallowWater || ev.value === GroundKind.DeepWater;
    return { style: "ring", color: water ? 0x38bdf8 : 0xd6d3d1, radius: 11, text: "" };
  },
};

function resolveDynamicCue(ev: WorldEvent): FeedbackCueSpec | null {
  return DYNAMIC_CUE_BUILDERS[ev.kind]?.(ev) ?? null;
}

export function resolveFeedbackEventCue(ev: WorldEvent): FeedbackCueSpec | null {
  const dyn = resolveDynamicCue(ev);
  if (dyn) return dyn;
  const base = STATIC_CUES[ev.kind];
  if (!base) return null;
  return ev.hitstopSec === undefined ? base : { ...base, hitstopSec: ev.hitstopSec };
}
