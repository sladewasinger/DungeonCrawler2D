# Sanctuary Hubs UI (`packages/client/src/ui/hubs`)

HTML modals and collapsible HUD tracker for Floor 1 Sanctuary Hubs & outer Frontier Safe Rooms:

- `hubStyles.ts`: Shared modal, Gold pill, `+N` slot upgrade badge, and `390×844` mobile-responsive styles.
- `merchantModal.ts`: Supply shop (`merchantBuy`) and bag sell-back (`merchantSell`) with atomic Gold validation (`[REQ-P9-08]`, `[REQ-P9-09]`).
- `blacksmithModal.ts`: Prefix reforging (`blacksmithReforge`) and `+1..+3` gear upgrading (`blacksmithUpgrade`) (`[REQ-P9-10]`, `[REQ-P9-11]`).
- `bountyModal.ts` & `bountyTrackerHud.ts`: 3-Bounty Board UI and compact live HUD objective tracker (`[REQ-P9-12]`).
- `guideModal.ts`: Floor Guide Mentor side-quests with dialogue & reward turn-in (`[REQ-P9-13]`).
- `stashModal.ts`: `27`-slot personal Sanctuary Stash bidirectional transfer & Take All UI (`[REQ-P9-06]`).
- `hubModalController.ts`: Unified controller connecting all 5 hub panels to `ModalRouter` and `WorldClient`.
