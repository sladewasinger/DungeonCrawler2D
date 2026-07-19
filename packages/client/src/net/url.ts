/**
 * Resolves the game server websocket URL per the deploy contract: same-origin
 * `wss://<host>/ws` when the page itself is served over https (prod, behind
 * CloudFront), `ws://localhost:8787` in dev. `?server=` always wins, for
 * pointing a dev client at a non-default server during testing.
 */

export interface LocationLike {
  protocol: string;
  host: string;
  search: string;
}

export function resolveWsUrl(loc: LocationLike): string {
  const override = new URLSearchParams(loc.search).get("server");
  if (override) return override;
  return loc.protocol === "https:" ? `wss://${loc.host}/ws` : "ws://localhost:8787";
}
