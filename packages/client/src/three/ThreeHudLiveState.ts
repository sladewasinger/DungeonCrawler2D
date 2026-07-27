import {
  INTERACT_RANGE,
  findWorldInteractionTarget,
  type World,
} from "@dc2d/engine";
import type { Connection } from "../net/connection.js";
import { activeLootChestNearby, nearestLootChest } from "../net/lootChestQuery.js";
import { nearestDownedPartyMember } from "../scenes/dungeon/contentQueries.js";
import {
  craftSnapshot,
  stashSnapshot,
} from "../scenes/dungeon/hudSnapshot.js";
import {
  resolveInteractionPrompt,
  type InteractionPrompt,
} from "../scenes/dungeon/interactionPrompt.js";
import { resolveContextualActionHelp } from "../ui/actionHelp.js";
import { resolveRemoteBossBar } from "../ui/widgets/hud/bossBarView.js";
import type { ThreeHudNoticeState } from "./ThreeHudNotices.js";
import type { ThreeHudNotices } from "./ThreeHudNotices.js";
import type { ThreeHudPanels } from "./ThreeHudPanels.js";

export function buildThreeHudLiveState(
  connection: Connection,
  world: World,
  selectedSlot: number,
) {
  return { ...stationState(connection, world), contacts: connection.contacts, notices: noticeState(connection, world, selectedSlot) };
}

function stationState(connection: Connection, world: World) {
  const body = connection.body;
  const craftNearby = isStationNearby(world, body, "craft");
  const stashNearby = activeLootChestNearby(connection) || isStationNearby(world, body, "stash");
  return {
    craft: craftSnapshot(connection.inventory, craftNearby),
    stash: stashSnapshot({ inventory: connection.inventory, stash: connection.stash, nearby: stashNearby, kind: connection.stashContext?.kind ?? "personal" }),
  };
}

function isStationNearby(world: World, body: Connection["body"], kind: "craft" | "stash"): boolean {
  return !!body && !!findWorldInteractionTarget({ world, x: body.x, y: body.y, kind });
}

function noticeState(connection: Connection, world: World, selectedSlot: number): ThreeHudNoticeState {
  return {
    boss: resolveRemoteBossBar(connection.entities.values()),
    interactionPrompt: resolvePrompt(connection, world),
    actionHints: resolveContextualActionHelp({
      selectedItemId: selectedSlot < 0
        ? null
        : connection.hotbar[selectedSlot] ?? null,
      weaponId: connection.weapon ?? null,
      canBlock: connection.canBlock,
    }),
    completedContextualActions: [...(connection.contextualActionsUsed ?? [])],
    reconnecting: connection.status !== "connected",
    reconnectAttempts: connection.reconnectAttempts,
    toasts: connection.toasts,
  };
}

export interface ThreeHudLiveStateSyncRequest {
  readonly connection: Connection;
  readonly world: World;
  readonly selectedSlot: number;
  readonly panels: ThreeHudPanels;
  readonly notices: ThreeHudNotices;
  readonly closeCraft: () => void;
  readonly closeStash: () => void;
}

export function syncThreeHudLiveState(request: ThreeHudLiveStateSyncRequest): void {
  const { connection, world, selectedSlot, panels, notices, closeCraft, closeStash } = request;
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
): InteractionPrompt | null {
  const body = connection.body;
  if (!body) return null;
  const items = [...connection.entities.values()]
    .map(({ snap }) => snap)
    .filter((snap) =>
      (snap.kind === "item" && snap.defId !== "player-loot-chest") ||
      (snap.kind === "torch" && snap.state === "placed")
    );
  const reviveTarget = connection.party
    ? nearestDownedPartyMember({ members: connection.party.members, fromX: body.x, fromY: body.y, maxDistance: INTERACT_RANGE })
    : undefined;
  const prompt = resolveInteractionPrompt({
    world, x: body.x, y: body.y, items, reviveTarget,
    lootChest: nearestLootChest(connection) ?? undefined,
  });
  return prompt ? { ...prompt, key: "E" } : null;
}
