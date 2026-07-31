export function spectatorUrl(
  search: string,
  options: SpectatorUrlOptions = {},
): string {
  const params = new URLSearchParams();
  const server = validServerOverride(new URLSearchParams(search).get("server"));
  if (server) params.set("server", server);
  if (options.embedded) params.set("embed", "admin");
  if (options.hud === false) params.set("hud", "0");
  if (options.mode) params.set("mode", options.mode);
  if (options.playerId) params.set("target", options.playerId);
  const query = params.toString();
  return `/spectate${query ? `?${query}` : ""}`;
}

export interface SpectatorUrlOptions {
  readonly embedded?: boolean;
  readonly hud?: boolean;
  readonly mode?: "free" | "track";
  readonly playerId?: string;
}

function validServerOverride(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:" ? url.href : null;
  } catch {
    return null;
  }
}
