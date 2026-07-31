import type { Connection } from "../../../../net/connection/connection.js";
import type { RemoteEntity } from "../../../../net/interpolation/interpolate.js";
import type {
  MinimapEntityMarker,
  MinimapEntityKind,
} from "../../../../ui/hud/model/minimap/minimapTypes.js";

interface EntityMarkerState {
  readonly selfId: string | undefined;
  readonly partyIds: ReadonlySet<string>;
  readonly seenPartyIds: Set<string>;
  readonly markers: MinimapEntityMarker[];
}

export const resolveMinimapEntityMarkers = (
  connection: Connection,
): MinimapEntityMarker[] => {
  const state = markerState(connection);
  appendRemoteMarkers(state, connection.entities);
  appendPartyMarkers(state, connection.party?.members ?? []);
  return state.markers;
};

const markerState = (connection: Connection): EntityMarkerState => ({
  selfId: connection.welcome?.playerId,
  partyIds: new Set(connection.party?.members.map((member) => member.id) ?? []),
  seenPartyIds: new Set(),
  markers: connection.body ? [{ kind: "self", x: connection.body.x, y: connection.body.y }] : [],
});

const appendRemoteMarkers = (
  state: EntityMarkerState,
  entities: ReadonlyMap<string, RemoteEntity>,
): void => {
  for (const [id, remote] of entities) appendRemoteMarker(state, id, remote);
};

const appendRemoteMarker = (
  state: EntityMarkerState,
  id: string,
  remote: RemoteEntity,
): void => {
  const marker = remoteMarker({ id, selfId: state.selfId, partyIds: state.partyIds, remote });
  if (!marker) return;
  state.markers.push(marker);
  if (marker.kind === "party") state.seenPartyIds.add(id);
};

interface RemoteMarkerRequest {
  readonly id: string;
  readonly selfId: string | undefined;
  readonly partyIds: ReadonlySet<string>;
  readonly remote: RemoteEntity;
}

const remoteMarker = ({
  id,
  selfId,
  partyIds,
  remote,
}: RemoteMarkerRequest): MinimapEntityMarker | null => {
  if (remote.snap.kind === "enemy") return marker("enemy", remote.snap.x, remote.snap.y);
  if (remote.snap.kind !== "player" || id === selfId) return null;
  const kind: MinimapEntityKind = partyIds.has(id) ? "party" : "player";
  return marker(kind, remote.snap.x, remote.snap.y);
};

const appendPartyMarkers = (
  state: EntityMarkerState,
  members: ReadonlyArray<{ id: string; x: number; y: number }>,
): void => {
  for (const member of members) {
    if (member.id === state.selfId || state.seenPartyIds.has(member.id)) continue;
    state.markers.push(marker("party", member.x, member.y));
  }
};

const marker = (
  kind: MinimapEntityKind,
  x: number,
  y: number,
): MinimapEntityMarker => ({ kind, x, y });
