import { territoryProfile, type TerritoryId } from "@dc2d/engine";

const TERRITORY_IDS = [
  "goblin-powderworks", "silkbound-broodcourt", "bone-tithe-ossuary",
  "chainwarden-gaol", "myconid-bellows", "kobold-countermine",
  "cultist-star-chapel", "ratkin-tannery", "ash-dwarf-smeltery",
  "wraith-mirror-ward", "mimic-treasury", "clockwork-reliquary",
  "thornbound-court", "carrion-aviary", "alchemist-containment-ward",
  "orc-drill-bastion", "saltbound-inquisition", "candle-monk-scriptorium",
  "crystal-resonator-guild", "grave-mason-yard",
] as const satisfies readonly TerritoryId[];

export interface PreviewTerritoryOption {
  readonly id: TerritoryId;
  readonly name: string;
  readonly description: string;
}

export const PREVIEW_TERRITORY_CATALOG: readonly PreviewTerritoryOption[] = Object.freeze(
  TERRITORY_IDS.map((id) => {
    const profile = territoryProfile(id);
    return Object.freeze({
      id,
      name: profile.name,
      description: `${profile.layoutSignature}; ${profile.materialBiome} material; ${profile.ownershipTags.join(", ")} ownership themes`,
    });
  }),
);
