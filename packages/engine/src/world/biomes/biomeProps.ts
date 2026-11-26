/** Deterministic biome-specific flora, crystal, and mineral prop scattering. */
import { GroundKind, PropKind, type BiomeKind } from "../types.js";

export interface PropChoice {
  readonly kind: PropKind;
  readonly radius: number;
  readonly blocks: boolean;
}

function chooseVerdant(roll: number, density: number, ground: GroundKind): PropChoice | null {
  if (roll < density * 0.045) return { kind: PropKind.PineTree, radius: 0.38, blocks: true };
  if (roll < density * 0.11) return { kind: PropKind.OakTree, radius: 0.38, blocks: true };
  if (roll < density * 0.15) return { kind: PropKind.Bush, radius: 0.34, blocks: true };
  if (roll < density * 0.165) return { kind: PropKind.Stump, radius: 0.3, blocks: true };
  if (roll < 0.36) return { kind: PropKind.TallGrass, radius: 0, blocks: false };
  if (roll < 0.44 && ground === GroundKind.MeadowGrass) return { kind: PropKind.Wildflower, radius: 0, blocks: false };
  return null;
}

function chooseAutumn(roll: number, density: number): PropChoice | null {
  if (roll < density * 0.055) return { kind: PropKind.MapleTree, radius: 0.38, blocks: true };
  if (roll < density * 0.105) return { kind: PropKind.BirchTree, radius: 0.36, blocks: true };
  if (roll < density * 0.125) return { kind: PropKind.OakTree, radius: 0.38, blocks: true };
  if (roll < density * 0.155) return { kind: PropKind.Bush, radius: 0.34, blocks: true };
  if (roll < density * 0.17) return { kind: PropKind.Stump, radius: 0.3, blocks: true };
  if (roll < 0.37) return { kind: PropKind.TallGrass, radius: 0, blocks: false };
  return null;
}

function chooseBog(roll: number, ground: GroundKind): PropChoice | null {
  if (ground === GroundKind.BogMud && roll < 0.12) return { kind: PropKind.BogReed, radius: 0, blocks: false };
  if (roll < 0.05) return { kind: PropKind.DeadTree, radius: 0.36, blocks: true };
  if (roll < 0.092) return { kind: PropKind.GiantMushroom, radius: 0.34, blocks: true };
  if (roll < 0.13) return { kind: PropKind.BogReed, radius: 0, blocks: false };
  if (roll < 0.155) return { kind: PropKind.Stump, radius: 0.3, blocks: true };
  return roll < 0.25 ? { kind: PropKind.TallGrass, radius: 0, blocks: false } : null;
}

function chooseHighland(roll: number, distOrigin: number): PropChoice | null {
  if (roll < 0.036) return { kind: PropKind.CopperVein, radius: 0.44, blocks: true };
  if (roll < 0.064 && distOrigin >= 900) return { kind: PropKind.IronVein, radius: 0.44, blocks: true };
  if (roll < 0.115) return { kind: PropKind.Boulder, radius: 0.42, blocks: true };
  return roll < 0.175 ? { kind: PropKind.PineTree, radius: 0.36, blocks: true } : null;
}

function chooseCursed(roll: number): PropChoice | null {
  if (roll < 0.038) return { kind: PropKind.CursedCrystal, radius: 0.38, blocks: true };
  if (roll < 0.075) return { kind: PropKind.DeadTree, radius: 0.36, blocks: true };
  if (roll < 0.105) return { kind: PropKind.RuinPillar, radius: 0.38, blocks: true };
  return roll < 0.14 ? { kind: PropKind.Boulder, radius: 0.42, blocks: true } : null;
}

const BIOME_PICKERS: Readonly<Record<BiomeKind, (opts: {
  readonly ground: GroundKind; readonly density: number; readonly roll: number; readonly distOrigin: number;
}) => PropChoice | null>> = {
  "verdant-forest": (o) => chooseVerdant(o.roll, o.density, o.ground),
  "autumn-woods": (o) => chooseAutumn(o.roll, o.density),
  "misty-bog": (o) => chooseBog(o.roll, o.ground),
  "craggy-highlands": (o) => chooseHighland(o.roll, o.distOrigin),
  "cursed-ruinlands": (o) => chooseCursed(o.roll),
};

export function chooseBiomeTileProp(opts: {
  readonly biome: BiomeKind;
  readonly ground: GroundKind;
  readonly density: number;
  readonly roll: number;
  readonly distOrigin: number;
}): PropChoice | null {
  if (opts.ground === GroundKind.Sand) return opts.roll < 0.04 ? { kind: PropKind.Boulder, radius: 0.38, blocks: true } : null;
  if (opts.ground === GroundKind.CliffStone || opts.ground === GroundKind.MossStone) return chooseHighland(opts.roll, opts.distOrigin);
  return BIOME_PICKERS[opts.biome](opts);
}
