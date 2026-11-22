/** Editable multi-track presets mirroring DungeonCrawler 2D's procedural Web Audio layers. */
import type { SoundPreset, SoundTrackSpec } from "./studioTypes.js";

const WAVE_SINE: OscillatorType = "sine";
const WAVE_TRI: OscillatorType = "triangle";
const F_LP: BiquadFilterType = "lowpass";
const F_BP: BiquadFilterType = "bandpass";
const T_NOISE = "noise" as const;
const T_SWEPT = "sweptNoise" as const;
const T_TONE = "tone" as const;

function trk(base: Omit<SoundTrackSpec, "enabled" | "solo">): SoundTrackSpec {
  return { ...base, enabled: true, solo: false };
}

export const STUDIO_PRESETS: readonly SoundPreset[] = [
  {
    id: "water-step",
    name: "Water Step Splash",
    description: "Inward/outward swept water turbulence layered with dual bright rising droplets.",
    tracks: [
      trk({ id: "ws1", name: "Upward Splash", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_BP, f0: 320, f1: 1200, q: 1.35, delaySec: 0, durationSec: 0.19, attackSec: 0.045, gain: 0.2 }),
      trk({ id: "ws2", name: "Sploosh Wash", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_LP, f0: 1320, f1: 340, q: 0.9, delaySec: 0.05, durationSec: 0.24, attackSec: 0.04, gain: 0.145 }),
      trk({ id: "ws3", name: "Droplet A", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 390, f1: 720, q: 1, delaySec: 0.075, durationSec: 0.042, attackSec: 0.01, gain: 0.068 }),
      trk({ id: "ws4", name: "Droplet B", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 560, f1: 980, q: 1, delaySec: 0.145, durationSec: 0.038, attackSec: 0.01, gain: 0.052 }),
    ],
  },
  {
    id: "water-plunge",
    name: "Water Jump Plunge",
    description: "Sub-bass displacement thump, wide foam wash, and 3-bubble scatter.",
    tracks: [
      trk({ id: "wp1", name: "Sub Plunge", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 115, f1: 45, q: 1, delaySec: 0, durationSec: 0.15, attackSec: 0.012, gain: 0.18 }),
      trk({ id: "wp2", name: "Foam Surge", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_BP, f0: 220, f1: 1010, q: 1.15, delaySec: 0, durationSec: 0.26, attackSec: 0.04, gain: 0.31 }),
      trk({ id: "wp3", name: "Downward Slosh", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_LP, f0: 1500, f1: 260, q: 0.85, delaySec: 0.06, durationSec: 0.34, attackSec: 0.045, gain: 0.26 }),
      trk({ id: "wp4", name: "Droplet High", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 660, f1: 1220, q: 1, delaySec: 0.24, durationSec: 0.038, attackSec: 0.01, gain: 0.056 }),
    ],
  },
  {
    id: "dirt-land",
    name: "Heavy Dirt Landing",
    description: "240ms downward low-end thump, mid soil sweep, and 3 descending clod settles.",
    tracks: [
      trk({ id: "dl1", name: "Earth Thump", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_LP, f0: 280, f1: 75, q: 0.55, delaySec: 0, durationSec: 0.24, attackSec: 0.012, gain: 0.378 }),
      trk({ id: "dl2", name: "Soil Displacement", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_LP, f0: 680, f1: 210, q: 0.65, delaySec: 0.012, durationSec: 0.23, attackSec: 0.028, gain: 0.115 }),
      trk({ id: "dl3", name: "Clod Grit 1", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 670, f1: 670, q: 0.75, delaySec: 0.045, durationSec: 0.085, attackSec: 0.012, gain: 0.085 }),
      trk({ id: "dl4", name: "Clod Grit 2", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 510, f1: 510, q: 0.8, delaySec: 0.11, durationSec: 0.095, attackSec: 0.012, gain: 0.06 }),
      trk({ id: "dl5", name: "Clod Grit 3", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 380, f1: 380, q: 0.8, delaySec: 0.18, durationSec: 0.09, attackSec: 0.012, gain: 0.038 }),
    ],
  },
  {
    id: "campfire-crackle",
    name: "Campfire Crackle & Pop",
    description: "Soft wood ember rumble paired with warm dry wood snap and sparkle pop.",
    tracks: [
      trk({ id: "cf1", name: "Hearth Rumble", kind: T_NOISE, wave: WAVE_SINE, filterType: F_LP, f0: 160, f1: 160, q: 0.7, delaySec: 0, durationSec: 0.36, attackSec: 0.06, gain: 0.14 }),
      trk({ id: "cf2", name: "Wood Crackle", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 620, f1: 620, q: 1.5, delaySec: 0.04, durationSec: 0.045, attackSec: 0.008, gain: 0.18 }),
      trk({ id: "cf3", name: "Ember Pop", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 1750, f1: 1750, q: 2.2, delaySec: 0.15, durationSec: 0.024, attackSec: 0.005, gain: 0.13 }),
    ],
  },
  {
    id: "sword-slash",
    name: "Iron Sword Slash",
    description: "Tight bandpass air slice backed by a fast metallic body sweep.",
    tracks: [
      trk({ id: "sw1", name: "Air Whoosh", kind: T_NOISE, wave: WAVE_SINE, filterType: F_BP, f0: 1350, f1: 1350, q: 1.8, delaySec: 0, durationSec: 0.14, attackSec: 0.014, gain: 0.18 }),
      trk({ id: "sw2", name: "Blade Resonance", kind: T_TONE, wave: WAVE_TRI, filterType: F_LP, f0: 290, f1: 120, q: 1, delaySec: 0, durationSec: 0.1, attackSec: 0.01, gain: 0.1 }),
    ],
  },
  {
    id: "shield-parry",
    name: "Shield Parry Ring",
    description: "Rising metallic ring + shimmering high-harmonic bell overtone.",
    tracks: [
      trk({ id: "pr1", name: "Steel Fundamental", kind: T_TONE, wave: WAVE_TRI, filterType: F_LP, f0: 1180, f1: 1620, q: 1, delaySec: 0, durationSec: 0.28, attackSec: 0.008, gain: 0.24 }),
      trk({ id: "pr2", name: "Shimmer Overtone", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 2360, f1: 1900, q: 1, delaySec: 0, durationSec: 0.22, attackSec: 0.008, gain: 0.14 }),
    ],
  },
  {
    id: "chest-open",
    name: "Treasure Chest Open",
    description: "Lid latch creak unfolding into a golden 3-note chime.",
    tracks: [
      trk({ id: "ch1", name: "Lid Creak", kind: T_SWEPT, wave: WAVE_SINE, filterType: F_BP, f0: 260, f1: 540, q: 2.4, delaySec: 0, durationSec: 0.16, attackSec: 0.02, gain: 0.14 }),
      trk({ id: "ch2", name: "Chime C5->E5", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 523, f1: 659, q: 1, delaySec: 0.04, durationSec: 0.12, attackSec: 0.01, gain: 0.13 }),
      trk({ id: "ch3", name: "Chime G5->C6", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 784, f1: 1046, q: 1, delaySec: 0.11, durationSec: 0.24, attackSec: 0.01, gain: 0.15 }),
    ],
  },
  {
    id: "dawn-bird",
    name: "Dawn Songbird Phrase",
    description: "Gentle 3-chirp forest songbird melody.",
    tracks: [
      trk({ id: "db1", name: "Chirp 1", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 2900, f1: 2680, q: 1, delaySec: 0, durationSec: 0.044, attackSec: 0.008, gain: 0.08 }),
      trk({ id: "db2", name: "Chirp 2", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 3250, f1: 2990, q: 1, delaySec: 0.075, durationSec: 0.044, attackSec: 0.008, gain: 0.075 }),
      trk({ id: "db3", name: "Chirp 3", kind: T_TONE, wave: WAVE_SINE, filterType: F_LP, f0: 3620, f1: 3400, q: 1, delaySec: 0.16, durationSec: 0.05, attackSec: 0.008, gain: 0.07 }),
    ],
  },
];
