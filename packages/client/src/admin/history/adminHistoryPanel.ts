import type { AdminHistoryEntry } from "@dc2d/engine";
import type { AdminCommandResult } from "../../net/connection/admin/adminMessages.js";
import { controlFieldset, text } from "../adminPagePrimitives.js";

export interface AdminHistoryPanel {
  readonly root: HTMLFieldSetElement;
  render(entries: readonly AdminHistoryEntry[]): void;
  showCommandResult(result: AdminCommandResult): void;
}

const EMPTY_HISTORY_MESSAGE = "No admin actions recorded during this server session.";

export function createAdminHistoryPanel(): AdminHistoryPanel {
  const root = controlFieldset("Admin history");
  root.dataset.adminHistory = "";
  root.style.cssText = "display:grid;gap:8px;max-height:310px;overflow:hidden";
  const status = text(EMPTY_HISTORY_MESSAGE);
  status.dataset.adminHistoryStatus = "";
  status.setAttribute("role", "status");
  const entries = document.createElement("ol");
  entries.dataset.adminHistoryEntries = "";
  entries.style.cssText = "display:grid;gap:6px;max-height:230px;overflow:auto;margin:0;padding:0 8px 0 22px";
  root.append(status, entries);
  let renderKey = "";
  return {
    root,
    render: (history) => {
      const nextKey = historyRenderKey(history);
      if (nextKey === renderKey) return;
      renderKey = nextKey;
      renderHistory({ entries, status, history });
    },
    showCommandResult: (result) => {
      status.textContent = commandResultMessage(result);
    },
  };
}

interface RenderHistoryInput {
  readonly entries: HTMLOListElement;
  readonly status: HTMLElement;
  readonly history: readonly AdminHistoryEntry[];
}

function renderHistory(input: RenderHistoryInput): void {
  if (input.history.length === 0) {
    input.status.textContent = EMPTY_HISTORY_MESSAGE;
    input.entries.replaceChildren();
    return;
  }
  input.status.textContent = `${input.history.length} recent actions from this server session`;
  input.entries.replaceChildren(...input.history.map(historyListItem));
}

function historyListItem(entry: AdminHistoryEntry): HTMLLIElement {
  const item = document.createElement("li");
  item.style.cssText = "display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:baseline";
  const timestamp = document.createElement("time");
  timestamp.dateTime = new Date(entry.at).toISOString();
  timestamp.textContent = localHistoryTime(entry.at);
  timestamp.style.cssText = "color:#96a9bf;font-variant-numeric:tabular-nums";
  const detail = document.createElement("span");
  detail.textContent = `${entry.actor} · ${entry.action}`;
  const result = document.createElement("strong");
  result.textContent = historyResultLabel(entry);
  result.dataset.ok = String(entry.ok);
  item.append(timestamp, detail, result);
  return item;
}

function historyRenderKey(entries: readonly AdminHistoryEntry[]): string {
  return entries.map((entry) => [entry.at, entry.actor, entry.action, entry.ok, entry.code ?? ""].join(":"))
    .join("|");
}

function localHistoryTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function historyResultLabel(entry: Pick<AdminHistoryEntry, "ok" | "code">): string {
  if (entry.ok) return "Succeeded";
  return entry.code ? `Rejected: ${entry.code}` : "Rejected";
}

export function commandResultMessage(result: AdminCommandResult): string {
  if (result.ok) return "Command accepted; the server history will update shortly.";
  return `Command rejected: ${result.message ?? result.code ?? "unknown"}`;
}
