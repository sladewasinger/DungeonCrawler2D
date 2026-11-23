/** Procedural HD-pixel sprite geometry for training dummies, overworld wildlife, and POI guards. */
import type { EntityKind } from "@dc2d/engine";
import type { Graphics } from "pixi.js";

const INK = 0x18181b;
const SLATE_OUT = 0x0f172a;
const EYE_RED = 0xef4444;
const WOOD_DK = 0x78350f;
const WOOD_MD = 0x92400e;
const BONE_LT = 0xf1f5f9;

function drawStrawDummy(body: Graphics): void {
  body.rect(-3, -6, 6, 6).fill(WOOD_DK);
  body.rect(-6, -15, 12, 10).fill(INK);
  body.rect(-5, -14, 10, 8).fill(0xca8a04);
  body.rect(-9, -14, 18, 4).fill(INK);
  body.rect(-8, -13, 16, 2).fill(0xa16207);
  body.rect(-4, -22, 8, 8).fill(INK);
  body.rect(-3, -21, 6, 6).fill(0xfacc15);
  body.rect(-2, -19, 1, 1).fill(INK);
  body.rect(1, -19, 1, 1).fill(INK);
}

function drawSlimeBody(body: Graphics): void {
  body.rect(-7, -11, 14, 11).fill(0x14532d);
  body.rect(-6, -10, 12, 9).fill(0x22c55e);
  body.rect(-5, -9, 10, 5).fill(0x4ade80);
  body.rect(-4, -8, 3, 2).fill(0x86efac);
  body.rect(-3, -6, 2, 2).fill(0x052e16);
  body.rect(1, -6, 2, 2).fill(0x052e16);
}

function drawSparringDummy(body: Graphics): void {
  body.rect(-3, -6, 6, 6).fill(0x475569);
  body.rect(-6, -16, 12, 11).fill(SLATE_OUT);
  body.rect(-5, -15, 10, 9).fill(0x64748b);
  body.rect(-4, -14, 4, 6).fill(0x94a3b8);
  body.rect(-5, -23, 10, 8).fill(SLATE_OUT);
  body.rect(-4, -22, 8, 6).fill(0x94a3b8);
  body.rect(-3, -19, 6, 2).fill(SLATE_OUT);
  body.rect(5, -14, 3, 9).fill(WOOD_MD);
  body.rect(-9, -15, 4, 7).fill(WOOD_DK);
}

function drawWolf(body: Graphics): void {
  body.rect(-8, -10, 15, 7).fill(0x334155);
  body.rect(-7, -9, 13, 5).fill(0x64748b);
  body.rect(-10, -11, 3, 2).fill(0x94a3b8);
  body.rect(2, -13, 7, 6).fill(0x475569);
  body.rect(3, -15, 2, 2).fill(0x94a3b8);
  body.rect(6, -15, 2, 2).fill(0x94a3b8);
  body.rect(7, -10, 4, 2).fill(0xcbd5e1);
  body.rect(6, -12, 2, 1).fill(0xfef08a);
  body.rect(-6, -4, 2, 4).fill(0x475569);
  body.rect(4, -4, 2, 4).fill(0x475569);
}

function drawBear(body: Graphics): void {
  body.rect(-10, -16, 20, 12).fill(0x451a03);
  body.rect(-9, -15, 18, 10).fill(WOOD_DK);
  body.rect(-6, -21, 12, 8).fill(WOOD_DK);
  body.rect(-7, -22, 3, 3).fill(WOOD_MD);
  body.rect(4, -22, 3, 3).fill(WOOD_MD);
  body.rect(-3, -17, 6, 3).fill(0xb45309);
  body.rect(-3, -19, 2, 1).fill(INK);
  body.rect(1, -19, 2, 1).fill(INK);
  body.rect(-8, -5, 4, 5).fill(0x451a03);
  body.rect(4, -5, 4, 5).fill(0x451a03);
}

function drawSpider(body: Graphics): void {
  body.rect(-9, -6, 18, 2).fill(INK);
  body.rect(-10, -3, 20, 2).fill(INK);
  body.rect(-7, -11, 14, 8).fill(0x1f2937);
  body.rect(-5, -10, 10, 6).fill(0x374151);
  body.rect(-3, -7, 2, 2).fill(EYE_RED);
  body.rect(1, -7, 2, 2).fill(EYE_RED);
}

function drawBoar(body: Graphics): void {
  body.rect(-8, -11, 16, 8).fill(0x3f2314);
  body.rect(-7, -10, 14, 6).fill(0x7c2d12);
  body.rect(4, -9, 6, 4).fill(0x9a3412);
  body.rect(8, -7, 3, 2).fill(0xfef3c7);
  body.rect(5, -10, 2, 1).fill(EYE_RED);
  body.rect(-6, -4, 3, 4).fill(0x3f2314);
  body.rect(4, -4, 3, 4).fill(0x3f2314);
}

function drawGoblin(body: Graphics): void {
  body.rect(-5, -13, 10, 9).fill(0x365314);
  body.rect(-4, -12, 8, 7).fill(0x65a30d);
  body.rect(-5, -20, 10, 7).fill(0x4d7c0f);
  body.rect(-8, -18, 3, 2).fill(0x84cc16);
  body.rect(5, -18, 3, 2).fill(0x84cc16);
  body.rect(-3, -18, 2, 2).fill(0xfacc15);
  body.rect(1, -18, 2, 2).fill(0xfacc15);
  body.rect(-4, -4, 3, 4).fill(WOOD_DK);
  body.rect(1, -4, 3, 4).fill(WOOD_DK);
}

function drawOrc(body: Graphics): void {
  body.rect(-7, -16, 14, 11).fill(0x14532d);
  body.rect(-6, -15, 12, 9).fill(0x15803d);
  body.rect(-5, -14, 10, 4).fill(0x475569);
  body.rect(-5, -23, 10, 8).fill(0x166534);
  body.rect(-3, -18, 2, 2).fill(BONE_LT);
  body.rect(1, -18, 2, 2).fill(BONE_LT);
  body.rect(-3, -21, 2, 1).fill(EYE_RED);
  body.rect(1, -21, 2, 1).fill(EYE_RED);
  body.rect(-5, -5, 4, 5).fill(0x334155);
  body.rect(1, -5, 4, 5).fill(0x334155);
}

function drawSkeleton(body: Graphics): void {
  body.rect(-4, -13, 8, 8).fill(SLATE_OUT);
  body.rect(-3, -12, 6, 7).fill(0xcbd5e1);
  body.rect(-4, -21, 8, 8).fill(SLATE_OUT);
  body.rect(-3, -20, 6, 6).fill(BONE_LT);
  body.rect(-2, -18, 2, 2).fill(SLATE_OUT);
  body.rect(1, -18, 2, 2).fill(SLATE_OUT);
  body.rect(-3, -5, 2, 5).fill(BONE_LT);
  body.rect(1, -5, 2, 5).fill(BONE_LT);
}

function drawGolem(body: Graphics): void {
  body.rect(-9, -18, 18, 13).fill(0x1e293b);
  body.rect(-8, -17, 16, 11).fill(0x475569);
  body.rect(-6, -24, 12, 7).fill(0x64748b);
  body.rect(-3, -21, 2, 2).fill(0x38bdf8);
  body.rect(1, -21, 2, 2).fill(0x38bdf8);
  body.rect(-4, -14, 8, 4).fill(0x15803d);
  body.rect(-7, -5, 5, 5).fill(0x334155);
  body.rect(2, -5, 5, 5).fill(0x334155);
}

const CREATURE_DRAWERS: Readonly<Record<EntityKind, (g: Graphics) => void>> = {
  dummy: drawStrawDummy,
  "slime-dummy": drawSlimeBody,
  "spar-dummy": drawSparringDummy,
  wolf: drawWolf,
  bear: drawBear,
  spider: drawSpider,
  boar: drawBoar,
  slime: drawSlimeBody,
  goblin: drawGoblin,
  orc: drawOrc,
  skeleton: drawSkeleton,
  golem: drawGolem,
};

export function drawCreatureBody(kind: EntityKind, body: Graphics): void {
  CREATURE_DRAWERS[kind](body);
}
