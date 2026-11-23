/** Procedural voice profiles for wild beasts: bear, boar, wolf, spider, and slime. */
import {
  C_BR, C_PK, C_WH, F_BP, F_HP, F_LP, W_SAW, W_SIN, W_TRI,
  burst, sweep, tone, type CreatureVoiceSet,
} from "./creatureVoiceTypes.js";

export type BeastVoiceKind = "bear" | "boar" | "wolf" | "spider" | "slime";

const BEAR_VOICES: CreatureVoiceSet = {
  alert: [
    tone({ wave: W_SAW, f0: 105, f1: 74, dur: 0.38, gain: 0.30, hold: 0.14 }),
    sweep({ f0: 440, f1: 220, filter: F_BP, color: C_PK, q: 1.5, atk: 0.03, dur: 0.38, gain: 0.32 }),
    sweep({ f0: 240, f1: 130, filter: F_LP, color: C_BR, q: 1.1, atk: 0.03, dur: 0.40, gain: 0.30 }),
  ],
  attack: [
    tone({ wave: W_SAW, f0: 162, f1: 82, dur: 0.30, gain: 0.34, hold: 0.10 }),
    sweep({ f0: 1180, f1: 380, filter: F_BP, color: C_PK, q: 1.2, atk: 0.015, dur: 0.25, gain: 0.32, delay: 0.02 }),
    burst({ freq: 520, filter: F_BP, color: C_PK, q: 1.3, dur: 0.18, gain: 0.24 }),
  ],
  charge: [
    tone({ wave: W_SAW, f0: 122, f1: 185, dur: 0.24, gain: 0.32 }),
    tone({ wave: W_SAW, f0: 180, f1: 88, dur: 0.38, gain: 0.34, delay: 0.18, hold: 0.14 }),
    sweep({ f0: 620, f1: 260, filter: F_BP, color: C_PK, q: 1.4, atk: 0.03, dur: 0.48, gain: 0.34 }),
  ],
  hurt: [
    tone({ wave: W_SAW, f0: 182, f1: 92, dur: 0.22, gain: 0.32 }),
    burst({ freq: 480, filter: F_BP, color: C_PK, q: 1.4, dur: 0.18, gain: 0.28 }),
  ],
  death: [
    tone({ wave: W_SAW, f0: 148, f1: 48, dur: 0.66, gain: 0.38, hold: 0.22 }),
    sweep({ f0: 540, f1: 140, filter: F_BP, color: C_PK, q: 1.3, atk: 0.04, dur: 0.64, gain: 0.34 }),
    sweep({ f0: 260, f1: 95, filter: F_LP, color: C_BR, q: 1.0, atk: 0.04, dur: 0.68, gain: 0.30 }),
  ],
};

const BOAR_VOICES: CreatureVoiceSet = {
  alert: [
    burst({ freq: 640, filter: F_BP, color: C_PK, q: 2.0, dur: 0.10, gain: 0.30 }),
    burst({ freq: 510, filter: F_BP, color: C_PK, q: 1.9, dur: 0.11, gain: 0.28, delay: 0.11 }),
    tone({ wave: W_SAW, f0: 155, f1: 104, dur: 0.19, gain: 0.24, delay: 0.09 }),
  ],
  attack: [
    tone({ wave: W_SAW, f0: 280, f1: 145, dur: 0.17, gain: 0.32 }),
    burst({ freq: 1120, filter: F_BP, color: C_WH, q: 1.7, dur: 0.07, gain: 0.26, delay: 0.02 }),
  ],
  charge: [
    tone({ wave: W_SAW, f0: 440, f1: 760, dur: 0.20, gain: 0.32 }),
    tone({ wave: W_SAW, f0: 740, f1: 390, dur: 0.26, gain: 0.32, delay: 0.15 }),
    sweep({ f0: 880, f1: 520, filter: F_BP, color: C_PK, q: 2.0, atk: 0.02, dur: 0.34, gain: 0.26 }),
    burst({ freq: 240, filter: F_LP, color: C_BR, q: 0.9, dur: 0.07, gain: 0.32 }),
    burst({ freq: 230, filter: F_LP, color: C_BR, q: 0.9, dur: 0.07, gain: 0.30, delay: 0.09 }),
    burst({ freq: 245, filter: F_LP, color: C_BR, q: 0.9, dur: 0.07, gain: 0.30, delay: 0.18 }),
    burst({ freq: 225, filter: F_LP, color: C_BR, q: 0.9, dur: 0.07, gain: 0.26, delay: 0.27 }),
  ],
  hurt: [
    tone({ wave: W_SAW, f0: 560, f1: 310, dur: 0.21, gain: 0.34 }),
    burst({ freq: 760, filter: F_BP, color: C_PK, q: 1.8, dur: 0.16, gain: 0.24 }),
  ],
  death: [
    tone({ wave: W_SAW, f0: 510, f1: 128, dur: 0.52, gain: 0.36, hold: 0.14 }),
    sweep({ f0: 660, f1: 210, filter: F_BP, color: C_PK, q: 1.3, atk: 0.02, dur: 0.48, gain: 0.28 }),
  ],
};

const WOLF_VOICES: CreatureVoiceSet = {
  alert: [
    tone({ wave: W_TRI, f0: 340, f1: 560, dur: 0.24, gain: 0.32 }),
    tone({ wave: W_TRI, f0: 560, f1: 380, dur: 0.30, gain: 0.32, delay: 0.20, hold: 0.10 }),
    tone({ wave: W_TRI, f0: 680, f1: 1020, dur: 0.22, gain: 0.16 }),
    sweep({ f0: 780, f1: 450, filter: F_BP, color: C_PK, q: 1.6, atk: 0.04, dur: 0.46, gain: 0.18 }),
  ],
  attack: [
    tone({ wave: W_SAW, f0: 265, f1: 172, dur: 0.18, gain: 0.32 }),
    burst({ freq: 1620, filter: F_BP, color: C_WH, q: 1.6, dur: 0.065, gain: 0.26, delay: 0.02 }),
  ],
  charge: [
    tone({ wave: W_SAW, f0: 310, f1: 205, dur: 0.14, gain: 0.30 }),
    tone({ wave: W_SAW, f0: 335, f1: 195, dur: 0.15, gain: 0.32, delay: 0.12 }),
  ],
  hurt: [
    tone({ wave: W_TRI, f0: 640, f1: 330, dur: 0.20, gain: 0.34 }),
    burst({ freq: 980, filter: F_BP, color: C_PK, q: 1.7, dur: 0.13, gain: 0.22 }),
  ],
  death: [
    tone({ wave: W_TRI, f0: 460, f1: 160, dur: 0.54, gain: 0.34, hold: 0.14 }),
    sweep({ f0: 680, f1: 240, filter: F_BP, color: C_PK, q: 1.4, atk: 0.02, dur: 0.48, gain: 0.22 }),
  ],
};

const SPIDER_VOICES: CreatureVoiceSet = {
  alert: [
    sweep({ f0: 3050, f1: 1750, filter: F_HP, color: C_WH, q: 2.2, atk: 0.01, dur: 0.25, gain: 0.28 }),
    burst({ freq: 2450, filter: F_BP, color: C_WH, q: 4.0, dur: 0.04, gain: 0.26 }),
    burst({ freq: 2880, filter: F_BP, color: C_WH, q: 4.0, dur: 0.04, gain: 0.26, delay: 0.055 }),
    burst({ freq: 2620, filter: F_BP, color: C_WH, q: 4.0, dur: 0.04, gain: 0.24, delay: 0.11 }),
  ],
  attack: [
    sweep({ f0: 3300, f1: 1280, filter: F_BP, color: C_WH, q: 2.0, atk: 0.008, dur: 0.18, gain: 0.32 }),
    burst({ freq: 1240, filter: F_BP, color: C_WH, q: 3.0, dur: 0.055, gain: 0.26, delay: 0.02 }),
  ],
  charge: [
    burst({ freq: 2400, filter: F_BP, color: C_WH, q: 4.2, dur: 0.035, gain: 0.25 }),
    burst({ freq: 2720, filter: F_BP, color: C_WH, q: 4.2, dur: 0.035, gain: 0.25, delay: 0.04 }),
    burst({ freq: 2550, filter: F_BP, color: C_WH, q: 4.2, dur: 0.035, gain: 0.25, delay: 0.08 }),
    burst({ freq: 2880, filter: F_BP, color: C_WH, q: 4.2, dur: 0.035, gain: 0.25, delay: 0.12 }),
    sweep({ f0: 3100, f1: 1600, filter: F_HP, color: C_WH, q: 2.0, atk: 0.01, dur: 0.20, gain: 0.24, delay: 0.02 }),
  ],
  hurt: [
    tone({ wave: W_SAW, f0: 1480, f1: 780, dur: 0.18, gain: 0.28 }),
    burst({ freq: 2250, filter: F_BP, color: C_WH, q: 2.8, dur: 0.10, gain: 0.24 }),
  ],
  death: [
    tone({ wave: W_SAW, f0: 1220, f1: 235, dur: 0.45, gain: 0.32, hold: 0.08 }),
    sweep({ f0: 2650, f1: 720, filter: F_BP, color: C_WH, q: 2.5, atk: 0.01, dur: 0.40, gain: 0.26 }),
  ],
};

const SLIME_VOICES: CreatureVoiceSet = {
  alert: [
    tone({ wave: W_SIN, f0: 210, f1: 480, dur: 0.22, gain: 0.34 }),
    sweep({ f0: 760, f1: 1520, filter: F_BP, color: C_PK, q: 3.2, atk: 0.02, dur: 0.24, gain: 0.26 }),
  ],
  attack: [
    tone({ wave: W_SIN, f0: 310, f1: 135, dur: 0.17, gain: 0.34 }),
    sweep({ f0: 980, f1: 390, filter: F_BP, color: C_PK, q: 2.6, atk: 0.01, dur: 0.17, gain: 0.28 }),
  ],
  charge: [
    tone({ wave: W_SIN, f0: 225, f1: 520, dur: 0.14, gain: 0.30 }),
    tone({ wave: W_SIN, f0: 280, f1: 145, dur: 0.15, gain: 0.28, delay: 0.10 }),
  ],
  hurt: [
    tone({ wave: W_SIN, f0: 380, f1: 175, dur: 0.17, gain: 0.34 }),
    burst({ freq: 920, filter: F_BP, color: C_PK, q: 2.4, dur: 0.12, gain: 0.24 }),
  ],
  death: [
    tone({ wave: W_SIN, f0: 480, f1: 98, dur: 0.30, gain: 0.38 }),
    sweep({ f0: 1680, f1: 500, filter: F_BP, color: C_PK, q: 2.4, atk: 0.01, dur: 0.34, gain: 0.30, delay: 0.04 }),
  ],
};

export const BEAST_VOICE_SPECS: Record<BeastVoiceKind, CreatureVoiceSet> = {
  bear: BEAR_VOICES,
  boar: BOAR_VOICES,
  wolf: WOLF_VOICES,
  spider: SPIDER_VOICES,
  slime: SLIME_VOICES,
};
