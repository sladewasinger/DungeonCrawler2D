export const FIRE_AREA_ID = "area-fire";
export const OIL_AREA_ID = "area-oil";
export const SMOKE_AREA_ID = "area-smoke";
export const STEAM_AREA_ID = "area-steam";
export const VODKA_AREA_ID = "area-vodka";
export const WET_AREA_ID = "area-wet";

export const AREA_TEST_DEFINITIONS = [
  {
    id: FIRE_AREA_ID,
    tags: ["fire", "hostile"],
    channel: "flame",
    priority: 20,
    buoyancy: 0,
    duration: 12,
    onEnterStatus: "on-fire",
    spread: { chance: 0.5, ontoAreaTag: "flammable", maxSteps: 6 },
    sprite: "fire",
  },
  {
    id: WET_AREA_ID,
    tags: ["wet", "liquid"],
    channel: "surface",
    priority: 20,
    buoyancy: -1,
    duration: 25,
    onEnterStatus: "wet",
    spread: { chance: 0.15, maxSteps: 2 },
    sprite: "wet",
  },
  {
    id: OIL_AREA_ID,
    tags: ["oil", "flammable", "liquid"],
    channel: "surface",
    priority: 10,
    buoyancy: -1,
    duration: 40,
    onEnterStatus: "oiled",
    spread: { chance: 0.1, maxSteps: 2 },
    sprite: "oil",
  },
  {
    id: VODKA_AREA_ID,
    tags: ["vodka", "flammable", "liquid"],
    channel: "surface",
    priority: 20,
    buoyancy: -1,
    duration: 20,
    sprite: "vodka",
  },
  {
    id: "area-poison",
    tags: ["poison", "gas", "hostile"],
    channel: "gas",
    priority: 10,
    buoyancy: -1,
    duration: 12,
    onEnterStatus: "poisoned",
    spread: { chance: 0.3, maxSteps: 4 },
    sprite: "poison",
  },
  {
    id: SMOKE_AREA_ID,
    tags: ["smoke", "gas"],
    channel: "gas",
    priority: 20,
    buoyancy: 1,
    duration: 8,
    spread: { chance: 0.3, maxSteps: 3 },
    sprite: "smoke",
  },
  {
    id: STEAM_AREA_ID,
    tags: ["steam", "gas"],
    channel: "gas",
    priority: 30,
    buoyancy: 1,
    duration: 4,
    sprite: "steam",
  },
];
