// Ground-item / thrown-projectile atlas frame lookup: reuses the HUD's item-id -> frame
// map (the same 0x72 pieces render whether an item sits in a hotbar slot or on the
// ground) with a generic fallback for the ids the pack has no icon for at all
// (assets/INVENTORY.md GAP #6: rag, stick, bandage, raw-meat, torch).
import { itemIconFrame } from "../../../ui/widgets/hud/inventory/itemIcon.js";

const FALLBACK_ITEM_FRAME = "skull";
const LOOT_CHEST_FRAME = "chest_full_open_anim_f0";

export function groundItemFrame(defId: string | undefined): string {
  if (!defId) return FALLBACK_ITEM_FRAME;
  if (defId === "player-loot-chest") return LOOT_CHEST_FRAME;
  return itemIconFrame(defId) ?? FALLBACK_ITEM_FRAME;
}
