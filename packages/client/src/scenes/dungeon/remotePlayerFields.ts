/** Maps replicated player snapshot fields into the remote-player render contract. */
import type { EntitySnapshot } from "@dc2d/engine";
import type { PlayerEntityView } from "../../render/entities/index.js";

export type RemotePlayerFields = Pick<PlayerEntityView,
  "name" | "skin" | "hp" | "maxHp" | "fx" | "faceX" | "faceY" | "air" | "downed" |
  "reviveProgress" | "disconnected" | "attacking" | "blocking" | "weaponId" |
  "weaponAimAngle" | "attackAngleRad">;

const REMOTE_DEFAULTS = {
  air: false,
  disconnected: false,
  downed: false,
  reviveProgress: 0,
  faceX: 1,
  faceY: 0,
  fx: [] as readonly string[],
  hp: 0,
  maxHp: 1,
  name: "?",
  weapon: null,
  blocking: false,
};

function valueOr<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export function remotePlayerFields(snapshot: EntitySnapshot): RemotePlayerFields {
  return remotePlayerFieldsInto(snapshot, {
    name: REMOTE_DEFAULTS.name,
    hp: REMOTE_DEFAULTS.hp,
    maxHp: REMOTE_DEFAULTS.maxHp,
    fx: REMOTE_DEFAULTS.fx,
    faceX: REMOTE_DEFAULTS.faceX,
    faceY: REMOTE_DEFAULTS.faceY,
    air: REMOTE_DEFAULTS.air,
    downed: REMOTE_DEFAULTS.downed,
    reviveProgress: REMOTE_DEFAULTS.reviveProgress,
    disconnected: REMOTE_DEFAULTS.disconnected,
    attacking: false,
    blocking: REMOTE_DEFAULTS.blocking,
    weaponId: REMOTE_DEFAULTS.weapon,
    weaponAimAngle: null,
    attackAngleRad: 0,
  });
}

export function remotePlayerFieldsInto(
  snapshot: EntitySnapshot,
  target: RemotePlayerFields,
): RemotePlayerFields {
  const faceX = valueOr(snapshot.faceX, REMOTE_DEFAULTS.faceX);
  const faceY = valueOr(snapshot.faceY, REMOTE_DEFAULTS.faceY);
  target.name = valueOr(snapshot.name, REMOTE_DEFAULTS.name);
  if (snapshot.skin === undefined) delete target.skin;
  else target.skin = snapshot.skin;
  target.hp = valueOr(snapshot.hp, REMOTE_DEFAULTS.hp);
  target.maxHp = valueOr(snapshot.maxHp, REMOTE_DEFAULTS.maxHp);
  target.fx = valueOr(snapshot.fx, REMOTE_DEFAULTS.fx);
  target.faceX = faceX === 0
    ? target.faceX ?? REMOTE_DEFAULTS.faceX
    : faceX;
  target.faceY = faceY;
  target.air = valueOr(snapshot.air, REMOTE_DEFAULTS.air);
  target.downed = valueOr(snapshot.downed, REMOTE_DEFAULTS.downed);
  target.reviveProgress = valueOr(snapshot.reviveProgress, REMOTE_DEFAULTS.reviveProgress);
  target.disconnected = valueOr(
    snapshot.disconnected,
    REMOTE_DEFAULTS.disconnected,
  );
  target.attacking = snapshot.anim === "attack";
  target.blocking = valueOr(snapshot.blocking, REMOTE_DEFAULTS.blocking);
  target.weaponId = valueOr(snapshot.weapon, REMOTE_DEFAULTS.weapon);
  target.weaponAimAngle = null;
  target.attackAngleRad = Math.atan2(faceY, faceX);
  return target;
}
