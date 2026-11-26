/** Fixed and rotating Merchant stock offers priced in authoritative Gold. */

export interface MerchantOfferDef {
  readonly id: string;
  readonly itemId: string;
  readonly quantity: number;
  readonly goldCost: number;
  readonly rotating?: boolean | undefined;
}

export const MERCHANT_STOCK: readonly MerchantOfferDef[] = [
  { id: "offer-arrows", itemId: "arrow", quantity: 12, goldCost: 24 },
  { id: "offer-bandage", itemId: "bandage", quantity: 2, goldCost: 22 },
  { id: "offer-salve", itemId: "healing-salve", quantity: 1, goldCost: 34 },
  { id: "offer-torch", itemId: "torch", quantity: 1, goldCost: 14 },
  { id: "offer-swiftness", itemId: "swiftness-draught", quantity: 1, goldCost: 42 },
  { id: "offer-ironbark", itemId: "ironbark-tonic", quantity: 1, goldCost: 65 },
  { id: "offer-copper-pick", itemId: "copper-pickaxe", quantity: 1, goldCost: 90 },
  { id: "offer-iron-ingot", itemId: "iron-ingot", quantity: 2, goldCost: 84 },
];

const CURIO_POOL: readonly MerchantOfferDef[] = [
  { id: "curio-herb-tea", itemId: "herb-tea", quantity: 2, goldCost: 52, rotating: true },
  { id: "curio-shadow-oil", itemId: "shadow-oil", quantity: 1, goldCost: 70, rotating: true },
  { id: "curio-sunstone", itemId: "sunstone", quantity: 1, goldCost: 110, rotating: true },
  { id: "curio-phoenix-salve", itemId: "phoenix-salve", quantity: 1, goldCost: 145, rotating: true },
];

export function resolveMerchantCatalog(worldSeed: number, cycleIndex = 0): readonly MerchantOfferDef[] {
  const idx = Math.abs(Math.floor(worldSeed + cycleIndex * 7)) % CURIO_POOL.length;
  const curio = CURIO_POOL[idx] ?? CURIO_POOL[0]!;
  return [...MERCHANT_STOCK, curio];
}

export function findMerchantOffer(offerId: string, worldSeed: number, cycleIndex = 0): MerchantOfferDef | undefined {
  return resolveMerchantCatalog(worldSeed, cycleIndex).find((o) => o.id === offerId);
}
