import { content } from "@dc2d/content";
import { TILE } from "@dc2d/engine";
import type { Connection } from "../net/connection";
import type { Panels } from "./panels";
import { downedAllyNearby, itemNearby, stashNearby, tableNearby, tileUnderfoot } from "./queries";

/** Contextual HUD text: key prompts, modal panel bodies, debug line. */

export function contextPrompt(conn: Connection): string {
  if (conn.dead) return "You are dead — controls disabled until respawn…";
  if (conn.downed) return "You are downed — hold on for a revive…";
  const underfoot = tileUnderfoot(conn);
  if (underfoot === TILE.DoorSafeRoom) return "[E] enter safe room";
  if (underfoot === TILE.DoorPersonal) return "[E] enter your room";
  if (underfoot === TILE.DoorParty) return "[E] enter party room";
  if (underfoot === TILE.DoorExit) return "[E] leave";
  if (downedAllyNearby(conn)) return "[E] revive party member";
  const prompts: string[] = [];
  if (itemNearby(conn)) prompts.push("[R] pick up");
  if (tableNearby(conn)) prompts.push("[C] craft");
  if (stashNearby(conn)) prompts.push("[E] stash");
  return prompts.join("   ");
}

export function panelContent(conn: Connection, panels: Panels): string | null {
  if (panels.craftOpen && tableNearby(conn)) {
    const lines = ["CRAFTING — press a number, [Esc] closes"];
    let n = 1;
    for (const recipe of content.recipes.values()) {
      const inputs = recipe.inputs
        .map((i) => `${i.qty}× ${content.items.get(i.item)?.name ?? i.item}`)
        .join(" + ");
      const output = content.items.get(recipe.output.item)?.name ?? recipe.output.item;
      lines.push(`[${n}] ${output}   (${inputs})`);
      n++;
    }
    return lines.join("\n");
  }
  if (panels.stashOpen && conn.stash && stashNearby(conn)) {
    const lines = ["STASH — number takes, [E] again refreshes, [Esc] closes"];
    conn.stash.forEach((entry, i) => {
      const name = content.items.get(entry.item)?.name ?? entry.item;
      lines.push(`[${i + 1}] ${name}${entry.qty > 1 ? ` ×${entry.qty}` : ""}`);
    });
    if (conn.stash.length === 0) lines.push("(empty)");
    const bound = conn.hotbar
      .map((item, index) => (item ? `[${index + 1}] ${content.items.get(item)?.name ?? item}` : null))
      .filter((entry): entry is string => entry !== null);
    lines.push("", "[1-9] take    [Shift+1-9] store bound stack");
    if (bound.length > 0) lines.push(...bound);
    return lines.join("\n");
  }
  return null;
}

export function debugContent(conn: Connection, fps: number): string {
  const body = conn.body!;
  return [
    `world ${conn.welcome!.worldSeed} floor ${conn.welcome!.floor}`,
    `pos ${body.x.toFixed(1)}, ${body.y.toFixed(1)}  z ${body.z.toFixed(2)}`,
    `ping ${conn.rttMs.toFixed(0)}ms  fps ${fps.toFixed(0)}`,
    `[G] chunk grid  [F] fistbump/invite`,
  ].join("\n");
}
