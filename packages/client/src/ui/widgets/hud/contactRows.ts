/** Pure row view-model for the contacts window (Epic 7.10): online first, then alphabetical. */

export interface ContactData {
  name: string;
  online: boolean;
}

export interface ContactRowView {
  name: string;
  online: boolean;
  statusLabel: "online" | "offline";
}

export function contactRowViews(contacts: readonly ContactData[]): ContactRowView[] {
  return [...contacts]
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((c) => ({ name: c.name, online: c.online, statusLabel: c.online ? "online" : "offline" }));
}
