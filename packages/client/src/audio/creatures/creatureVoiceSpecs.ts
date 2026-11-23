/** Organic procedural voice profiles for wild beasts: bear, boar, wolf, spider, and slime. */
import {
  C_BR, C_PK, C_WH, F_BP, F_HP, F_LP, W_SAW, W_SIN, W_TRI,
  burst, sweep, tone, vocal, type CreatureVoiceSet,
} from "./creatureVoiceTypes.js";

export type BeastVoiceKind = "bear" | "boar" | "wolf" | "spider" | "slime";

const BEAR_VOICES: CreatureVoiceSet = {
  alert: [
    vocal({ wave: W_SAW, f0: 92, f1: 68, filter: F_LP, color: C_BR, q: 2.4, atk: 0.04, dur: 0.42, gain: 0.40, hold: 0.16 }),
    sweep({ f0: 420, f1: 220, filter: F_BP, color: C_PK, q: 1.4, atk: 0.03, dur: 0.38, gain: 0.26 }),
    burst({ freq: 150, filter: F_LP, color: C_BR, q: 0.9, dur: 0.18, gain: 0.24 }),
  ],
  attack: [
    vocal({ wave: W_SAW, f0: 145, f1: 78, filter: F_LP, color: C_BR, q: 4.8, atk: 0.02, dur: 0.32, gain: 0.42, hold: 0.12 }),
    vocal({ wave: W_SAW, f0: 185, f1: 105, filter: F_BP, color: C_PK, q: 3.6, atk: 0.015, dur: 0.20, gain: 0.30 }),
    sweep({ f0: 1150, f1: 340, filter: F_BP, color: C_PK, q: 1.1, atk: 0.015, dur: 0.22, gain: 0.30, delay: 0.02 }),
  ],
  charge: [
    vocal({ wave: W_SAW, f0: 105, f1: 168, filter: F_LP, color: C_BR, q: 3.6, atk: 0.03, dur: 0.25, gain: 0.38 }),
    vocal({ wave: W_SAW, f0: 168, f1: 82, filter: F_BP, color: C_PK, q: 5.2, atk: 0.02, dur: 0.40, gain: 0.40, delay: 0.18, hold: 0.14 }),
    sweep({ f0: 460, f1: 150, filter: F_LP, color: C_BR, q: 1.1, atk: 0.03, dur: 0.50, gain: 0.30 }),
  ],
  hurt: [
    vocal({ wave: W_SAW, f0: 175, f1: 88, filter: F_LP, color: C_BR, q: 4.2, atk: 0.015, dur: 0.22, gain: 0.38 }),
    burst({ freq: 520, filter: F_BP, color: C_PK, q: 1.4, dur: 0.14, gain: 0.24 }),
  ],
  death: [
    vocal({ wave: W_SAW, f0: 138, f1: 46, filter: F_LP, color: C_BR, q: 3.0, atk: 0.04, dur: 0.68, gain: 0.44, hold: 0.22 }),
    vocal({ wave: W_SAW, f0: 162, f1: 64, filter: F_BP, color: C_PK, q: 2.2, atk: 0.03, dur: 0.52, gain: 0.32, delay: 0.06 }),
    sweep({ f0: 320, f1: 95, filter: F_LP, color: C_BR, q: 1.0, atk: 0.04, dur: 0.72, gain: 0.26 }),
  ],
};

const BOAR_VOICES: CreatureVoiceSet = {
  alert: [
    sweep({ f0: 320, f1: 640, filter: F_BP, color: C_PK, q: 2.4, atk: 0.015, dur: 0.11, gain: 0.32 }),
    sweep({ f0: 300, f1: 540, filter: F_BP, color: C_PK, q: 2.2, atk: 0.015, dur: 0.11, gain: 0.28, delay: 0.12 }),
    vocal({ wave: W_SAW, f0: 128, f1: 96, filter: F_BP, color: C_PK, q: 6.8, atk: 0.02, dur: 0.20, gain: 0.34, delay: 0.09 }),
  ],
  attack: [
    vocal({ wave: W_SAW, f0: 175, f1: 92, filter: F_BP, color: C_PK, q: 7.2, atk: 0.015, dur: 0.22, gain: 0.38 }),
    sweep({ f0: 920, f1: 360, filter: F_BP, color: C_PK, q: 1.8, atk: 0.012, dur: 0.14, gain: 0.26 }),
    burst({ freq: 1320, filter: F_BP, color: C_WH, q: 3.0, dur: 0.045, gain: 0.26, delay: 0.03 }),
  ],
  charge: [
    vocal({ wave: W_SAW, f0: 155, f1: 215, filter: F_BP, color: C_PK, q: 7.8, atk: 0.015, dur: 0.15, gain: 0.34 }),
    vocal({ wave: W_SAW, f0: 310, f1: 440, filter: F_HP, color: C_PK, q: 6.4, atk: 0.02, dur: 0.18, gain: 0.34, delay: 0.10 }),
    vocal({ wave: W_SAW, f0: 245, f1: 118, filter: F_BP, color: C_BR, q: 7.0, atk: 0.02, dur: 0.26, gain: 0.34, delay: 0.22 }),
    sweep({ f0: 1050, f1: 440, filter: F_BP, color: C_PK, q: 1.9, atk: 0.02, dur: 0.36, gain: 0.26 }),
    burst({ freq: 220, filter: F_LP, color: C_BR, q: 0.9, dur: 0.065, gain: 0.30 }),
    burst({ freq: 820, filter: F_BP, color: C_PK, q: 1.4, dur: 0.04, gain: 0.18, delay: 0.085 }),
    burst({ freq: 230, filter: F_LP, color: C_BR, q: 0.9, dur: 0.065, gain: 0.28, delay: 0.17 }),
    burst({ freq: 215, filter: F_LP, color: C_BR, q: 0.9, dur: 0.065, gain: 0.26, delay: 0.255 }),
  ],
  hurt: [
    vocal({ wave: W_SAW, f0: 390, f1: 220, filter: F_HP, color: C_PK, q: 5.2, atk: 0.012, dur: 0.22, gain: 0.36 }),
    burst({ freq: 840, filter: F_BP, color: C_PK, q: 2.0, dur: 0.15, gain: 0.24 }),
  ],
  death: [
    vocal({ wave: W_SAW, f0: 360, f1: 105, filter: F_BP, color: C_PK, q: 4.8, atk: 0.02, dur: 0.52, gain: 0.38, hold: 0.14 }),
    sweep({ f0: 620, f1: 160, filter: F_BP, color: C_BR, q: 1.4, atk: 0.02, dur: 0.48, gain: 0.28, delay: 0.05 }),
  ],
};

const WOLF_VOICES: CreatureVoiceSet = {
  alert: [
    vocal({ wave: W_TRI, f0: 310, f1: 540, filter: F_BP, color: C_PK, q: 1.4, atk: 0.03, dur: 0.25, gain: 0.34 }),
    vocal({ wave: W_TRI, f0: 540, f1: 340, filter: F_BP, color: C_PK, q: 1.6, atk: 0.02, dur: 0.34, gain: 0.34, delay: 0.20, hold: 0.12 }),
    tone({ wave: W_TRI, f0: 640, f1: 980, dur: 0.22, gain: 0.12 }),
    sweep({ f0: 780, f1: 440, filter: F_BP, color: C_PK, q: 1.6, atk: 0.04, dur: 0.48, gain: 0.16 }),
  ],
  attack: [
    vocal({ wave: W_SAW, f0: 215, f1: 128, filter: F_BP, color: C_PK, q: 5.8, atk: 0.012, dur: 0.20, gain: 0.36 }),
    burst({ freq: 1650, filter: F_BP, color: C_WH, q: 2.2, dur: 0.055, gain: 0.28, delay: 0.025 }),
  ],
  charge: [
    vocal({ wave: W_SAW, f0: 250, f1: 155, filter: F_BP, color: C_PK, q: 6.0, atk: 0.01, dur: 0.14, gain: 0.34 }),
    vocal({ wave: W_SAW, f0: 275, f1: 150, filter: F_BP, color: C_PK, q: 6.0, atk: 0.01, dur: 0.16, gain: 0.34, delay: 0.12 }),
  ],
  hurt: [
    vocal({ wave: W_TRI, f0: 560, f1: 280, filter: F_HP, color: C_PK, q: 2.8, atk: 0.01, dur: 0.20, gain: 0.34 }),
    burst({ freq: 1020, filter: F_BP, color: C_PK, q: 1.7, dur: 0.12, gain: 0.20 }),
  ],
  death: [
    vocal({ wave: W_TRI, f0: 430, f1: 145, filter: F_BP, color: C_PK, q: 2.0, atk: 0.02, dur: 0.54, gain: 0.34, hold: 0.14 }),
    sweep({ f0: 680, f1: 220, filter: F_BP, color: C_PK, q: 1.4, atk: 0.02, dur: 0.48, gain: 0.20 }),
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
    vocal({ wave: W_SAW, f0: 980, f1: 540, filter: F_HP, color: C_WH, q: 8.2, atk: 0.008, dur: 0.18, gain: 0.30 }),
    burst({ freq: 2250, filter: F_BP, color: C_WH, q: 2.8, dur: 0.10, gain: 0.24 }),
  ],
  death: [
    vocal({ wave: W_SAW, f0: 860, f1: 190, filter: F_HP, color: C_WH, q: 6.5, atk: 0.012, dur: 0.45, gain: 0.32, hold: 0.08 }),
    sweep({ f0: 2650, f1: 720, filter: F_BP, color: C_WH, q: 2.5, atk: 0.01, dur: 0.40, gain: 0.24 }),
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
