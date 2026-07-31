import type { AdminPlayer } from "@dc2d/engine";
import { cell } from "../adminPagePrimitives.js";

export function renderAdminPlayers(
  input: AdminPlayerTableInput,
): void {
  input.playersElement.replaceChildren(...input.players.map((player) => playerRow({
    player,
    authenticated: input.authenticated,
    selectedPlayerId: input.selectedPlayerId,
  })));
}

export interface AdminPlayerTableInput {
  readonly playersElement: HTMLTableSectionElement;
  readonly players: readonly AdminPlayer[];
  readonly authenticated: boolean;
  readonly selectedPlayerId: string | null;
}

interface PlayerRowInput {
  readonly player: AdminPlayer;
  readonly authenticated: boolean;
  readonly selectedPlayerId: string | null;
}

function playerRow(input: PlayerRowInput): HTMLTableRowElement {
  const { player, authenticated, selectedPlayerId } = input;
  const row = document.createElement("tr");
  row.dataset.adminPlayerSelect = "";
  row.dataset.playerId = player.playerId;
  row.dataset.selected = String(player.playerId === selectedPlayerId);
  row.tabIndex = authenticated ? 0 : -1;
  row.setAttribute("aria-selected", String(player.playerId === selectedPlayerId));
  row.append(
    cell(playerIdentity(player)),
    cell(positionText(player)),
    cell(statusText(player)),
  );
  return row;
}

function playerIdentity(player: AdminPlayer): string {
  const device = [player.platform, pointerType(player.touch)]
    .filter(Boolean)
    .join(" · ");
  return [
    `${player.name} · ${player.playerId}`,
    device || undefined,
    player.userAgent,
  ].filter(Boolean).join("\n");
}

function pointerType(touch: boolean | undefined): string | undefined {
  if (touch === undefined) return undefined;
  return touch ? "touch" : "pointer";
}

function positionText(player: AdminPlayer): string {
  return `${player.level} / floor ${player.floor} · ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, z${player.z.toFixed(1)}`;
}

function statusText(player: AdminPlayer): string {
  const flags = [
    player.downed ? "downed" : "alive",
    player.god ? "god" : "",
    player.handicapped ? "handicap" : "",
  ];
  const statuses = player.statuses.length ? ` · ${player.statuses.join(", ")}` : "";
  return `${flags.filter(Boolean).join(" · ")} · ${player.hp}/${player.maxHp} hp${statuses}`;
}
