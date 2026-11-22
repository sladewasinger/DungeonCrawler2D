/** Maps ground item and loot chest network snapshots into render views. */
import { TICK_RATE } from "@dc2d/engine";
import type { InterpolatedEntity } from "../../../../net/interpolation/interpolate.js";
import type { ItemEntityView } from "../../../../render/entities/geometry/index.js";
import { groundItemFrame } from "../itemFrame.js";
import type { ItemViewSource } from "../viewTypes.js";

export function itemView(source: ItemViewSource): ItemEntityView {
  const { e, target, context } = source;
  const view = target ?? {} as ItemEntityView;
  view.id = e.id;
  view.x = e.x;
  view.y = e.y;
  view.z = e.z;
  view.frame = groundItemFrame(e.snap.defId);
  if (isWorldLootChest(e)) {
    applyWorldLootFields(view, e);
    return view;
  }
  if (!isPlayerLootChest(e)) {
    clearLootView(view);
    return view;
  }
  applyDeathLootFields({ view, e, context });
  return view;
}

function applyWorldLootFields(view: ItemEntityView, e: InterpolatedEntity): void {
  view.lootLabel = e.snap.name!;
  view.lootIsWorldChest = true;
  delete view.lootKillerName;
  delete view.lootLockSeconds;
  view.lootNearby = false;
}

function applyDeathLootFields(input: {
  readonly view: ItemEntityView;
  readonly e: InterpolatedEntity;
  readonly context: ItemViewSource["context"];
}): void {
  const { view, e, context } = input;
  delete view.lootIsWorldChest;
  view.lootLabel = `[DEAD] ${e.snap.lootOwnerName}'s loot`;
  if (e.snap.lootKillerName === undefined) delete view.lootKillerName;
  else view.lootKillerName = e.snap.lootKillerName;
  view.lootLockSeconds = Math.ceil(Math.max(
    0,
    (e.snap.lootUnlockAtTick ?? 0) - (context?.serverTick ?? 0),
  ) / TICK_RATE);
  view.lootNearby = !!context &&
    Math.hypot(e.x - context.selfX, e.y - context.selfY) <= 3.5;
}

function isWorldLootChest(e: InterpolatedEntity): boolean {
  return e.snap.defId === "player-loot-chest"
    && Boolean(e.snap.name && !e.snap.name.startsWith("[DEAD]"));
}

function isPlayerLootChest(e: InterpolatedEntity): boolean {
  return e.snap.defId === "player-loot-chest" && e.snap.lootOwnerName !== undefined;
}

function clearLootView(view: ItemEntityView): void {
  delete view.lootLabel; delete view.lootIsWorldChest; delete view.lootKillerName;
  delete view.lootLockSeconds; delete view.lootNearby;
}
