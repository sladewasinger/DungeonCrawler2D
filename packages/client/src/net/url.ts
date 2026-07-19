/**
 * Resolves the game server websocket URL per the deploy contract: same-origin
 * `wss://<host>/ws` when the page itself is served over https (prod, behind
 * CloudFront), `ws://<page-hostname>:8787` in dev — never a hardcoded
 * `localhost`, which on a phone loading the dev server over the LAN resolves
 * to the phone itself, not the dev machine. `?server=` always wins, for
 * pointing a dev client at a non-default server during testing.
 */

export interface LocationLike {
  protocol: string;
  host: string;
  hostname: string;
  search: string;
}

export function resolveWsUrl(loc: LocationLike): string {
  const override = new URLSearchParams(loc.search).get("server");
  if (override) return override;
  return loc.protocol === "https:" ? `wss://${loc.host}/ws` : `ws://${loc.hostname}:8787`;
}
