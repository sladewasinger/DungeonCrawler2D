/**
 * Pure chat-tab state model (Epic 7.9): which tab is active (global is the boot
 * default — the wave-3 ruling), which inactive tabs hold unread lines, when the
 * dm tab lights up, and how /r resolves its reply target from the log.
 */

export type ChatTabId = "global" | "local" | "party" | "dm";

/** Tab strip order — global leftmost and DEFAULT on boot per the wave-3 brief. */
export const CHAT_TABS: readonly ChatTabId[] = ["global", "local", "party", "dm"];

export interface ChatTabsState {
  active: ChatTabId;
  unread: Record<ChatTabId, boolean>;
  /** Flips true on first dm traffic — the dm tab renders dimmed until then. */
  dmSeen: boolean;
}

export function createChatTabsState(): ChatTabsState {
  return {
    active: "global",
    unread: { global: false, local: false, party: false, dm: false },
    dmSeen: false,
  };
}

/** The tab a server line files under, or null for lines every tab shows (system). */
export function tabForChannel(channel: string): ChatTabId | null {
  return channel === "global" || channel === "local" || channel === "party" || channel === "dm"
    ? channel
    : null;
}

/** Records one incoming line: lights the dm tab and dots any inactive tab it lands on. */
export function recordIncoming(state: ChatTabsState, channel: string): void {
  const tab = tabForChannel(channel);
  if (tab === null) return; // system lines show everywhere — no single tab to dot
  if (tab === "dm") state.dmSeen = true;
  if (tab !== state.active) state.unread[tab] = true;
}

export function selectTab(state: ChatTabsState, tab: ChatTabId): void {
  state.active = tab;
  state.unread[tab] = false;
}

/** Whether a line with this channel renders on the given tab (system lines render on all). */
export function lineVisibleOn(channel: string, tab: ChatTabId): boolean {
  return tabForChannel(channel) === tab || tabForChannel(channel) === null;
}

/**
 * /r target: the most recent DM correspondent in either direction (ASSUMPTION #18).
 * Works for sent AND received lines because the server sets `target` to "the other
 * side of the thread" on each copy it delivers.
 */
export function lastDmPartner(
  log: readonly { channel: string; target?: string }[],
): string | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const line = log[i];
    if (line && line.channel === "dm" && line.target) return line.target;
  }
  return null;
}
