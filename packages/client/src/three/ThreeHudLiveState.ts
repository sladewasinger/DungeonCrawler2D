import {
  INTERACT_RANGE,
  findWorldInteractionTarget,
  type World,
} from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import {
  isConsumableItem,
  itemName,
  nearestDownedPartyMember,
} from "../scenes/dungeon/contentQueries.js";
import {
  craftSnapshot,
  stashSnapshot,
} from "../scenes/dungeon/hudSnapshot.js";
import {
  resolveInteractionPrompt,
  type InteractionPrompt,
} from "../scenes/dungeon/interactionPrompt.js";
import { resolveBossBar } from "../ui/widgets/hud/bossBarView.js";
import type { ThreeHudNoticeState } from "./ThreeHudNotices.js";
import type { ThreeHudNotices } from "./ThreeHudNotices.js";
import type { ThreeHudPanels } from "./ThreeHudPanels.js";

export function buildThreeHudLiveState(
  connection: Connection,
  world: World,
  selectedSlot: number,
) {
  const body = connection.body;
  const craftNearby = !!body &&
    !!findWorldInteractionTarget(world, body.x, body.y, "craft");
  const stashNearby = !!body &&
    !!findWorldInteractionTarget(world, body.x, body.y, "stash");
  const stations = {
    craft: craftSnapshot(connection.inventory, craftNearby),
    stash: stashSnapshot(connection.inventory, connection.stash, stashNearby),
  };
  const notices: ThreeHudNoticeState = {
    boss: resolveBossBar([...connection.entities.values()].map(({ snap }) => snap)),
    interactionPrompt: resolvePrompt(connection, world, selectedSlot),
    reconnecting: connection.status !== "connected",
    reconnectAttempts: connection.reconnectAttempts,
    toasts: connection.toasts,
  };
  return { ...stations, contacts: connection.contacts, notices };
}

export function syncThreeHudLiveState(
  connection: Connection,
  world: World,
  selectedSlot: number,
  panels: ThreeHudPanels,
  notices: ThreeHudNotices,
  closeCraft: () => void,
  closeStash: () => void,
): void {
  const state = buildThreeHudLiveState(connection, world, selectedSlot);
  panels.contacts.update(state.contacts);
  panels.craft.update(state.craft); panels.stash.update(state.stash);
  notices.update(state.notices, performance.now());
  if (!state.craft.nearby) closeCraft();
  if (!state.stash.nearby) closeStash();
}

function resolvePrompt(
  connection: Connection,
  world: World,
  selectedSlot: number,
): InteractionPrompt | null {
  const body = connection.body;
  if (!body) return null;
  const items = [...connection.entities.values()]
    .map(({ snap }) => snap)
    .filter(({ kind }) => kind === "item");
  const reviveTarget = connection.party
    ? nearestDownedPartyMember(
      connection.party.members,
      body.x,
      body.y,
      INTERACT_RANGE,
    )
    : undefined;
  const item = selectedSlot < 0 ? null : connection.hotbar[selectedSlot];
  const selectedName = item && isConsumableItem(item) ? itemName(item) : undefined;
  const prompt = resolveInteractionPrompt(
    world,
    body.x,
    body.y,
    items,
    reviveTarget,
    selectedName,
  );
  return prompt ? { ...prompt, key: "E" } : null;
}
