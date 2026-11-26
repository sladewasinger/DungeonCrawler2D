/** Coordinates all 5 Sanctuary Hub modals & HUD Bounty Tracker cleanly outside saturated ui/hud/. */
import type { ActiveBountyState, ActiveQuestState, InventorySlot, InventorySnapshot } from "@dc2d/engine";
import type { NpcKind } from "@dc2d/contracts";
import { BlacksmithModal } from "./blacksmithModal.js";
import { BountyModal } from "./bountyModal.js";
import { BountyTrackerHud } from "./bountyTrackerHud.js";
import { GuideModal } from "./guideModal.js";
import { ensureHubStyles } from "./hubStyles.js";
import { MerchantModal } from "./merchantModal.js";
import { StashModal } from "./stashModal.js";

export type HubStationKind = NpcKind | "stash";

export interface HubUiCallbacks {
  readonly onMerchantBuy: (offerId: string, count: number) => void;
  readonly onMerchantSell: (slotIndex: number) => void;
  readonly onBlacksmithReforge: (slotIndex: number) => void;
  readonly onBlacksmithUpgrade: (slotIndex: number) => void;
  readonly onBountyAccept: (bountyId: string) => void;
  readonly onBountyClaim: (bountyId: string) => void;
  readonly onQuestAccept: (questId: string) => void;
  readonly onQuestClaim: (questId: string) => void;
  readonly onStashQuickMove: (req: { readonly from: "stash" | "inv"; readonly slotIndex: number }) => void;
  readonly onStashTakeAll: () => void;
  readonly onBeforeOpen?: () => void;
}

export class HubModalController {
  readonly merchant: MerchantModal;
  readonly blacksmith: BlacksmithModal;
  readonly bounty: BountyModal;
  readonly guide: GuideModal;
  readonly stash: StashModal;
  readonly tracker: BountyTrackerHud;
  private active: HubStationKind | null = null;

  constructor(host: HTMLElement, private readonly cb: HubUiCallbacks) {
    ensureHubStyles();
    const close = () => this.close();
    this.merchant = new MerchantModal(host, { onBuy: cb.onMerchantBuy, onSell: cb.onMerchantSell, onClose: close });
    this.blacksmith = new BlacksmithModal(host, { onReforge: cb.onBlacksmithReforge, onUpgrade: cb.onBlacksmithUpgrade, onClose: close });
    this.bounty = new BountyModal(host, { onAccept: cb.onBountyAccept, onClaim: cb.onBountyClaim, onClose: close });
    this.guide = new GuideModal(host, { onAccept: cb.onQuestAccept, onClaim: cb.onQuestClaim, onClose: close });
    this.stash = new StashModal(host, { onQuickMove: cb.onStashQuickMove, onTakeAll: cb.onStashTakeAll, onClose: close });
    this.tracker = new BountyTrackerHud(host);
  }

  activeStation(): HubStationKind | null { return this.active; }
  isOpen(): boolean { return this.active !== null; }

  openStation(kind: HubStationKind): void {
    this.cb.onBeforeOpen?.();
    this.active = kind;
  }

  close(): void {
    this.active = null;
  }

  showNotice(text: string): void {
    if (this.active === "merchant") this.merchant.showNotice(text);
    else if (this.active === "blacksmith") this.blacksmith.showNotice(text);
    else if (this.active === "bounty-board") this.bounty.showNotice(text);
    else if (this.active === "guide") this.guide.showNotice(text);
  }

  sync(opts: {
    readonly inv: InventorySnapshot;
    readonly gold: number;
    readonly worldSeed: number;
    readonly stash: readonly InventorySlot[];
    readonly bounties: readonly ActiveBountyState[];
    readonly quests: readonly ActiveQuestState[];
  }): void {
    this.tracker.sync(opts.bounties);
    this.merchant.sync({ open: this.active === "merchant", gold: opts.gold, inv: opts.inv, worldSeed: opts.worldSeed });
    this.blacksmith.sync({ open: this.active === "blacksmith", gold: opts.gold, inv: opts.inv });
    this.bounty.sync({ open: this.active === "bounty-board", bounties: opts.bounties });
    this.guide.sync({ open: this.active === "guide", quests: opts.quests });
    this.stash.sync({ open: this.active === "stash", stash: opts.stash, inv: opts.inv });
  }
}
