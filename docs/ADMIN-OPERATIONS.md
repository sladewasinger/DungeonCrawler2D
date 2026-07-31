# Local admin and spectator operations

The repository now contains a complete local admin lane. It is deliberately
server-authoritative: the browser is a control surface, not a source of truth.

## Local development

Start the game server with `ADMIN_TOKEN` set to a secret that is supplied out
of band. Open `/admin` (or use `?admin=1` in the client URL), enter the token,
and authenticate over the WebSocket. The token is never placed in the URL or
written to diagnostics. A process-shared limiter permits two failed token
attempts and closes the socket on the third within a rolling ten-minute window.
It is keyed by normalized peer address, so reconnecting does not reset the
budget. Authenticated portal and gameplay-chat commands share a 40-command,
rolling ten-second budget for that peer.
Resume attempts have their own eight-attempt, rolling ten-second peer budget
before the server resolves an opaque session key or emits state.

After a successful login, the portal stores a server-issued, opaque 256-bit
continuation key in **tab-scoped `sessionStorage`**. It lets that tab restore
the authenticated portal after a page refresh without storing `ADMIN_TOKEN` in
the URL or `localStorage`. The key is peer-bound, expires after eight hours of
inactivity, and becomes invalid after a server restart; an expired continuation
key simply returns the portal to its token prompt. It is a session credential,
so do not run untrusted script on the admin origin.

The portal receives a lightweight authenticated observer update about four
times per second. Player presence, position, and status update automatically,
including crawlers still in the protected spawn room; the former manual
“Refresh players” action is not required. Keep the game and `/admin` on the
same WebSocket server: normal dev pages resolve to port `8787`, while the local
production-preview pair resolves to `4002`. If those modes are mixed, the
portal will correctly show the players of a different server process.

By default, the limiter uses the WebSocket peer address. Production runs behind
CloudFront with `TRUST_PROXY=1`; CloudFront preserves supplied values and
appends the verified viewer address at the right end of `X-Forwarded-For`, so
the limiter selects that rightmost address. Do not enable proxy trust for a
directly exposed server or log the complete forwarding chain.

The portal provides:

- an independently navigable canvas height-map inspector;
- a contextual player control area: select a player, then choose server-
  authoritative actions such as **Spectate**, heal, kill, teleport, god,
  handicap, enemy-radius, or **Grant/Revoke Admin**;
- a full read-only game-renderer viewer with smooth player tracking, untethered
  free camera, center, previous/next, and optional HUD controls. The black
  viewer space stays in the layout while Spectate is off, but its iframe and
  server subscription do not;
- a scrollable sprite-and-stat catalog for every enemy, item, weapon, and pet in
  content; categories and card stats derive from the authored definition, so a
  newly added spawnable definition appears without a portal allowlist. Unknown
  atlas art uses a neutral fallback glyph; selecting a card keeps the existing
  map/floor/inspect/kind/definition control order intact. Weapon cards include
  damage, range, knockback, and cooldown; enemy cards include authored hitbox
  width and depth;
- click placement on validated walkable cells, normalized by the server to each
  tile's exact center; right-clicking an enemy or weapon marker requests its
  authenticated server-side despawn. Items, players, and map props cannot be
  removed through this context action.
- no portal debug checkboxes. An active admin gets the compact debug panel in
  the in-game HUD instead; its switches draw actual hurtboxes, attacks,
  guards, line-of-sight, behavior/search, and navigation overlays in both
  renderers.

Observer updates contain only player presence and spectator state. The
inspector map, palette, and debug settings remain on the authenticated
command-response path, so a live viewer cannot reset an operator's map or
catalog selection. The separate spectator subscription receives only the
selected player's sanitized presentation state and releases its capacity when
the viewer is disabled.

The same command service is available from gameplay chat to either a connection
that has authenticated the server admin token or a currently live admin player.
**Grant Admin** changes only that connected player's in-memory role; **Revoke
Admin** removes it and its debug settings immediately. A verified player resume
token can retain that live role, but a client id or stored profile never can.
The legacy persisted `adminGranted` value is not an authentication factor and
never auto-authenticates a client-supplied `clientId`. Example
commands are `/admin track <playerId>`, `/admin heal <playerId>`,
`/admin teleport <playerId> spawn`, `/admin map dungeon 1 0 0 10`, and
`/admin spawn enemy slime 12.5 8.5 dungeon 1`. Ordinary gameplay connections
receive an authorization failure and their chat is not forwarded as an admin
command. The admin portal itself uses a separate authenticated WebSocket
session. Revoking a live role does not terminate an already token-authenticated
portal session.

The local token is read when the server starts. To revoke access to a shared
token, replace `ADMIN_TOKEN` and perform a full server restart. After restart,
clients reconnect and must authenticate with the new token. Logging out revokes
every live socket and continuation key bound to that server-issued session;
active commands extend its eight-hour inactivity lease, while passive observer
updates do not. Stored role records cannot revoke a holder of the current
shared token.

Admin state, map cells, palettes, and command results are only emitted on the
authenticated admin path. An active gameplay admin receives only its own
private debug flags and nearby debug entities; ordinary snapshots contain none
of those fields. All accepted and rejected controller commands are sent to a
bounded audit sink; token values are never part of audit records.

## Identity and persistence boundary

Local development uses `PlayerStore`, a memory or JSON-file adapter keyed by
stable anonymous `clientId`. It stores the local profile id, display name,
user-agent/platform/touch metadata, and a legacy `adminGranted` record. This
is not IP-based authorization; that record and the metadata are not credentials
or local session-revocation mechanisms.

Future account-backed administration should verify an identity-provider JWT
(for example Cognito), map the verified subject to a stable identity record,
and persist role grants in DynamoDB. The current bounded audit sink already
writes sanitized operational events when production DynamoDB configuration is
present.

The current server uses the local env-token boundary intentionally. Replacing
that boundary with the production provider is an infrastructure integration,
not a client-side fallback and not an IP-based grant.

## Durable operational history

Terraform defines an encrypted, point-in-time-recoverable DynamoDB table for
sanitized connection, admin, security, and server lifecycle events. Records
expire individually through DynamoDB TTL after
`operational_event_retention_days` (365 days by default). Each new event gets a
fresh one-year expiration, so recent history remains available for a player who
is active at least annually without keeping older events forever. Records can
be queried by player or anonymized peer actor key, or
chronologically through the daily `by_time` index. The EC2 role can only write
items; investigations require a separately authorized operator identity.

This table contains operational events, not player profiles. Production player
state remains in `/var/lib/dungeoncrawler2d/players.json` on the EC2 volume and
uses the separate EBS/AWS Backup lifecycle. Expiring a history event does not
delete a player character or saved state.

Raw network addresses are never written. Production creates a random
`OPERATIONAL_EVENT_PEPPER` once in an access-restricted environment file on the
encrypted instance volume. The bootstrap restricts that service-owned file to
mode `0600`. The server uses it to make one-way peer
fingerprints without retaining the original address. The key is not a
Terraform variable, EC2 user-data value, application log field, or DynamoDB
attribute.

Operational writes use a bounded asynchronous queue and short request timeout,
so an AWS outage cannot block the game loop or grow memory without limit.
Connection records cover open, successful join/resume, and close reason.
Admin records include command outcome and bounded target player IDs. Dropped
or failed writes become structured log events so missing history is visible.

The server log is shipped to CloudWatch Logs and retained for 14 days by
default. Uncaught exceptions, unhandled
rejections, WebSocket server errors, and individual WebSocket errors are
serialized as sanitized JSON with a bounded stack trace. Terraform defines a
metric filter, alarm, and dashboard query. Applying Terraform is still an
operator step; repository presence is not proof those resources are live.

## Future production maintenance controls

The `/admin` page is part of the static client hosted by S3 and CloudFront. It
is not served from the EC2 game server; it connects to that server through the
same CloudFront WebSocket origin as the game.

A production maintenance panel can use two deliberately separate paths:

- game startup settings such as world seed, VOID terrain, spawn radius, and idle
  timeout can use the existing authenticated admin WebSocket. The server should
  validate and persist staged values in its dedicated runtime environment file,
  announce maintenance, save connected players, and exit cleanly so systemd
  restarts it;
- lighting and debug presentation should remain live client/admin settings and
  should not restart the server;
- graceful restart can use the same server path: drain, persist players, audit
  the operator, and let systemd restart the process;
- CloudWatch log search can be exposed through a bounded read-only query API
  that redacts sensitive fields and limits time range and result count;
- a world-seed change must be a typed, confirmed maintenance operation that
  shows the current and proposed seed, verifies a fresh player-data backup,
  updates the durable game runtime configuration, and schedules the restart;
- AWS infrastructure settings such as retention, backups, instance size, IAM,
  and CloudWatch access remain in Terraform or a separately authenticated,
  least-privilege AWS API.

Every maintenance action needs a durable audit event and a narrowly scoped
capability. Do not give the WebSocket game process general EC2, SSM, Terraform,
or CloudWatch-read permissions merely to add game-setting buttons. The current
portal can host both UI groups while the game server owns only its own settings
and an AWS maintenance API owns infrastructure operations.
