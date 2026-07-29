import type { ChatPanelModel } from "../../../ui/chat/controller.js";
import { buildHudSnapshot, type HudSnapshotSource } from "./hudSnapshot.js";

export function source(overrides: Partial<HudSnapshotSource> = {}): HudSnapshotSource {
  return {
    playerId: "self",
    hp: 20,
    maxHp: 30,
    stamina: 100,
    maxStamina: 100,
    blocking: false,
    staminaExhausted: false,
    xp: 0,
    level: 1,
    xpForNext: 100,
    hotbar: [null, null, null, null, null, null, null, null, null],
    inventory: [],
    weapon: null,
    fx: [],
    statusEffects: [],
    pingMs: 40,
    connected: true,
    reconnecting: false,
    reconnectAttempts: 0,
    downed: false,
    dead: false,
    party: null,
    craftTableNearby: false,
    stashNearby: false,
    stash: null,
    lastToast: null,
    toasts: [],
    seedInputText: null,
    floor: 1,
    boss: null,
    ...overrides,
  };
}

export const FPS = 60;
export const BODY_POS = { x: 0, y: 0, z: 0 };
export const CHAT_MODEL: ChatPanelModel = { tabs: [], lines: [] };
export const CONTACTS: never[] = [];
export const COMPASS = 0;
export const STAIRWAY = null;

interface SnapshotTestOptions {
  readonly selectedSlot?: number | null;
  readonly fps?: number;
  readonly bodyPos?: typeof BODY_POS;
}

export function snapshotOf(src: HudSnapshotSource, options: SnapshotTestOptions = {}) {
  const { selectedSlot = null, fps = FPS, bodyPos = BODY_POS } = options;
  return buildHudSnapshot({
    src,
    selectedHotbarSlot: selectedSlot,
    armedThrowableSlot: null,
    interactionPrompt: null,
    touch: null,
    fps,
    bodyPos,
    chatModel: CHAT_MODEL,
    contacts: CONTACTS,
    compassBearingDeg: COMPASS,
    stairway: STAIRWAY,
  });
}
