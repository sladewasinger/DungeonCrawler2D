/** Organic procedural voice profiles for POI enemies: goblin, orc, skeleton, and golem. */
import {
  C_BR, C_PK, C_WH, F_BP, F_HP, F_LP, W_SAW, W_SIN, W_TRI,
  burst, sweep, tone, vocal, type CreatureVoiceSet,
} from "./creatureVoiceTypes.js";

export type PoiVoiceKind = "goblin" | "orc" | "skeleton" | "golem";

const GOBLIN_VOICES: CreatureVoiceSet = {
  alert: [
    vocal({ wave: W_SAW, f0: 360, f1: 560, filter: F_HP, color: C_PK, q: 5.5, atk: 0.012, dur: 0.14, gain: 0.30 }),
    vocal({ wave: W_SAW, f0: 440, f1: 295, filter: F_BP, color: C_PK, q: 6.2, atk: 0.012, dur: 0.18, gain: 0.30, delay: 0.11 }),
    burst({ freq: 1320, filter: F_BP, color: C_PK, q: 2.1, dur: 0.14, gain: 0.18, delay: 0.04 }),
  ],
  attack: [
    vocal({ wave: W_SAW, f0: 480, f1: 280, filter: F_HP, color: C_PK, q: 6.4, atk: 0.01, dur: 0.18, gain: 0.34 }),
    sweep({ f0: 1480, f1: 780, filter: F_BP, color: C_PK, q: 1.8, atk: 0.01, dur: 0.16, gain: 0.24 }),
  ],
  charge: [
    vocal({ wave: W_SAW, f0: 420, f1: 690, filter: F_HP, color: C_PK, q: 6.0, atk: 0.015, dur: 0.28, gain: 0.32 }),
    burst({ freq: 1420, filter: F_BP, color: C_PK, q: 2.0, dur: 0.20, gain: 0.20 }),
  ],
  hurt: [
    vocal({ wave: W_SAW, f0: 560, f1: 260, filter: F_HP, color: C_PK, q: 5.2, atk: 0.01, dur: 0.19, gain: 0.34 }),
    burst({ freq: 1140, filter: F_BP, color: C_PK, q: 2.0, dur: 0.11, gain: 0.20 }),
  ],
  death: [
    vocal({ wave: W_SAW, f0: 460, f1: 120, filter: F_BP, color: C_PK, q: 4.5, atk: 0.018, dur: 0.48, gain: 0.36, hold: 0.10 }),
    sweep({ f0: 1020, f1: 310, filter: F_BP, color: C_PK, q: 1.5, atk: 0.02, dur: 0.38, gain: 0.22 }),
  ],
};

const ORC_VOICES: CreatureVoiceSet = {
  alert: [
    vocal({ wave: W_SAW, f0: 118, f1: 84, filter: F_LP, color: C_BR, q: 4.2, atk: 0.018, dur: 0.16, gain: 0.34 }),
    vocal({ wave: W_SAW, f0: 142, f1: 92, filter: F_BP, color: C_PK, q: 4.8, atk: 0.018, dur: 0.22, gain: 0.36, delay: 0.13 }),
    sweep({ f0: 560, f1: 310, filter: F_BP, color: C_PK, q: 1.5, atk: 0.02, dur: 0.24, gain: 0.24, delay: 0.11 }),
  ],
  attack: [
    vocal({ wave: W_SAW, f0: 162, f1: 82, filter: F_LP, color: C_BR, q: 5.2, atk: 0.015, dur: 0.26, gain: 0.38, hold: 0.08 }),
    sweep({ f0: 820, f1: 260, filter: F_BP, color: C_PK, q: 1.4, atk: 0.015, dur: 0.22, gain: 0.30 }),
  ],
  charge: [
    vocal({ wave: W_SAW, f0: 110, f1: 198, filter: F_BP, color: C_PK, q: 5.0, atk: 0.025, dur: 0.36, gain: 0.38, hold: 0.10 }),
    sweep({ f0: 640, f1: 360, filter: F_BP, color: C_PK, q: 1.4, atk: 0.03, dur: 0.36, gain: 0.28 }),
  ],
  hurt: [
    vocal({ wave: W_SAW, f0: 168, f1: 86, filter: F_LP, color: C_BR, q: 4.4, atk: 0.012, dur: 0.20, gain: 0.36 }),
    burst({ freq: 480, filter: F_BP, color: C_PK, q: 1.4, dur: 0.14, gain: 0.24 }),
  ],
  death: [
    vocal({ wave: W_SAW, f0: 134, f1: 48, filter: F_LP, color: C_BR, q: 3.6, atk: 0.03, dur: 0.60, gain: 0.42, hold: 0.16 }),
    sweep({ f0: 460, f1: 160, filter: F_BP, color: C_PK, q: 1.2, atk: 0.03, dur: 0.52, gain: 0.28 }),
  ],
};

const SKELETON_VOICES: CreatureVoiceSet = {
  alert: [
    burst({ freq: 1480, filter: F_BP, color: C_WH, q: 4.5, dur: 0.045, gain: 0.28 }),
    burst({ freq: 1960, filter: F_BP, color: C_WH, q: 4.5, dur: 0.045, gain: 0.26, delay: 0.06 }),
    burst({ freq: 1720, filter: F_BP, color: C_WH, q: 4.5, dur: 0.045, gain: 0.26, delay: 0.12 }),
    burst({ freq: 2180, filter: F_BP, color: C_WH, q: 4.5, dur: 0.055, gain: 0.22, delay: 0.18 }),
  ],
  attack: [
    burst({ freq: 2200, filter: F_BP, color: C_WH, q: 4.2, dur: 0.055, gain: 0.30 }),
    sweep({ f0: 980, f1: 540, filter: F_BP, color: C_PK, q: 2.0, atk: 0.01, dur: 0.15, gain: 0.26 }),
  ],
  charge: [
    burst({ freq: 1650, filter: F_BP, color: C_WH, q: 4.4, dur: 0.04, gain: 0.26 }),
    burst({ freq: 1880, filter: F_BP, color: C_WH, q: 4.4, dur: 0.04, gain: 0.26, delay: 0.05 }),
    burst({ freq: 2100, filter: F_BP, color: C_WH, q: 4.4, dur: 0.04, gain: 0.24, delay: 0.10 }),
    burst({ freq: 1750, filter: F_BP, color: C_WH, q: 4.4, dur: 0.04, gain: 0.24, delay: 0.15 }),
  ],
  hurt: [
    burst({ freq: 2350, filter: F_HP, color: C_WH, q: 2.2, dur: 0.09, gain: 0.28 }),
    tone({ wave: W_TRI, f0: 720, f1: 340, dur: 0.11, gain: 0.24 }),
  ],
  death: [
    burst({ freq: 1950, filter: F_BP, color: C_WH, q: 4.2, dur: 0.065, gain: 0.32 }),
    burst({ freq: 1480, filter: F_BP, color: C_WH, q: 4.2, dur: 0.065, gain: 0.30, delay: 0.07 }),
    burst({ freq: 1140, filter: F_BP, color: C_WH, q: 4.0, dur: 0.075, gain: 0.28, delay: 0.14 }),
    burst({ freq: 840, filter: F_BP, color: C_WH, q: 3.6, dur: 0.085, gain: 0.26, delay: 0.22 }),
    burst({ freq: 540, filter: F_BP, color: C_PK, q: 2.6, dur: 0.11, gain: 0.24, delay: 0.29 }),
  ],
};

const GOLEM_VOICES: CreatureVoiceSet = {
  alert: [
    tone({ wave: W_TRI, f0: 68, f1: 92, dur: 0.44, gain: 0.36, hold: 0.16 }),
    sweep({ f0: 560, f1: 270, filter: F_BP, color: C_PK, q: 1.8, atk: 0.05, dur: 0.48, gain: 0.34 }),
    sweep({ f0: 320, f1: 165, filter: F_LP, color: C_BR, q: 1.4, atk: 0.06, dur: 0.50, gain: 0.32 }),
  ],
  attack: [
    tone({ wave: W_SIN, f0: 94, f1: 38, dur: 0.26, gain: 0.40 }),
    burst({ freq: 740, filter: F_BP, color: C_PK, q: 1.5, dur: 0.18, gain: 0.34, delay: 0.02 }),
  ],
  charge: [
    tone({ wave: W_SIN, f0: 82, f1: 44, dur: 0.24, gain: 0.36 }),
    burst({ freq: 320, filter: F_LP, color: C_BR, q: 1.2, dur: 0.36, gain: 0.34 }),
    burst({ freq: 620, filter: F_BP, color: C_PK, q: 1.6, dur: 0.16, gain: 0.28, delay: 0.16 }),
  ],
  hurt: [
    burst({ freq: 1720, filter: F_BP, color: C_WH, q: 3.2, dur: 0.08, gain: 0.28 }),
    burst({ freq: 520, filter: F_BP, color: C_PK, q: 1.6, dur: 0.13, gain: 0.26 }),
    tone({ wave: W_SIN, f0: 102, f1: 56, dur: 0.16, gain: 0.32 }),
  ],
  death: [
    tone({ wave: W_SIN, f0: 96, f1: 30, dur: 0.56, gain: 0.42, hold: 0.18 }),
    burst({ freq: 340, filter: F_LP, color: C_BR, q: 1.1, dur: 0.36, gain: 0.36, delay: 0.04 }),
    burst({ freq: 780, filter: F_BP, color: C_PK, q: 1.6, dur: 0.26, gain: 0.30, delay: 0.18 }),
    burst({ freq: 480, filter: F_LP, color: C_BR, q: 1.2, dur: 0.30, gain: 0.30, delay: 0.32 }),
  ],
};

export const POI_VOICE_SPECS: Record<PoiVoiceKind, CreatureVoiceSet> = {
  goblin: GOBLIN_VOICES,
  orc: ORC_VOICES,
  skeleton: SKELETON_VOICES,
  golem: GOLEM_VOICES,
};
