/** Owns query-driven fake HUD state used only by screenshot and gallery previews. */
import {
  fakeHudSnapshot,
  type HudFakeSnapshot,
} from "../ui/widgets/hud/fakeData.js";
import type { HudWidgets } from "../ui/widgets/hud/index.js";

const FAKE_BOSS = {
  name: "The Warden of Five",
  hp: 640,
  maxHp: 900,
};

export const resolveHudPreview = (
  params: URLSearchParams,
): HudFakeSnapshot | null => {
  const mode = params.get("hud");
  if (mode !== "1" && mode !== "death") return null;
  return fakeHudSnapshot(mode === "death");
};

export const applyHudPreviewAids = (
  params: URLSearchParams,
  snapshot: HudFakeSnapshot | undefined,
  hud: HudWidgets | undefined,
): void => {
  applyBossPreview(params, snapshot);
  if (params.get("inventory") === "1") hud?.toggleInventory();
  if (params.get("craft") === "1") hud?.toggleCraftPanel();
  if (params.get("stash") === "1") hud?.openStashPanel();
};

function applyBossPreview(params: URLSearchParams, snapshot: HudFakeSnapshot | undefined): void {
  if (params.get("boss") !== "1" || !snapshot) return;
  snapshot.boss = FAKE_BOSS;
}
