/**
 * Resolves the game server websocket URL per the deploy contract: same-origin
 * `wss://<host>/ws` when the page itself is served over https (prod, behind
 * CloudFront), `ws://<page-hostname>:8787` in dev, or the local production
 * preview pair's `ws://<page-hostname>:4002` when the page is on port 4001 — never a hardcoded
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
  if (loc.protocol === "https:") return `wss://${loc.host}/ws`;
  const serverPort = loc.host.endsWith(":4001") ? 4002 : 8787;
  return `ws://${loc.hostname}:${serverPort}`;
}
