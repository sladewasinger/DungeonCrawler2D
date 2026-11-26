# Hub Catalogs (`packages/content/src/hubs`)

Pure declarative Sanctuary & Outer Safe Room economy, Floor Guide quests, and rotating Bounty templates:

- `merchantCatalog.ts`: Fixed supplies (`MERCHANT_STOCK`) + biome curios (`rollMerchantCurios`) priced in Gold.
- `quests.ts`: `FLOOR_GUIDE_QUESTS` (`4` Floor 1 side-quests with objectives and deterministic rewards).
- `bounties.ts`: `BOUNTY_TEMPLATES` & seeded `generateFloorBounties` selecting `3` distinct bounties per floor cycle.
