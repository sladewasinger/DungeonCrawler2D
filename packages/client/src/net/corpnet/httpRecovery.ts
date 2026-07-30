/**
 * HTTP snapshot recovery is intentionally unavailable in the current deploy
 * topology. The game server owns a raw WebSocket listener, not an HTTP request
 * handler, and resume tokens become authorized only after a WebSocket hello
 * binds them to a live socket entry. Sending that bearer-like token through a
 * query string or ad-hoc HTTP header would expose it to proxies, logs, and
 * caches without giving the server a safe way to validate or rate-limit it.
 *
 * A future HTTP recovery endpoint requires a same-origin HTTPS handler plus a
 * short-lived, request-bound recovery credential issued during the WebSocket
 * handshake. Until then CorpNet uses the existing authenticated WebSocket
 * `snapshotResync` request, only after a meaningful receive stall and with
 * exponential backoff.
 */
export const HTTP_SNAPSHOT_RECOVERY_UNAVAILABLE = true;
