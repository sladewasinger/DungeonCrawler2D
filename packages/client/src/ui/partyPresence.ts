/** Formats one party member's reconnect presence consistently across both HUD renderers. */
export interface PartyPresence {
  label: string;
  color: string | undefined;
}

export function partyPresence(name: string, disconnected: boolean): PartyPresence {
  if (disconnected) return { label: `${name} Disconnected`, color: "#b6b6bf" };
  return { label: name, color: undefined };
}
