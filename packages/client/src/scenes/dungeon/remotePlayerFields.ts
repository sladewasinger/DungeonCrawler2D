/** Maps replicated player snapshot fields into the remote-player render contract. */
import type { EntitySnapshot } from "@dc2d/engine";
import type { PlayerEntityView } from "../../render/entities/index.js";

export type RemotePlayerFields = Pick<PlayerEntityView,
  "name" | "hp" | "maxHp" | "fx" | "faceX" | "faceY" | "air" | "downed" |
  "disconnected" | "attacking" | "blocking" | "weaponId" |
  "weaponAimAngle" | "attackAngleRad">;

const REMOTE_DEFAULTS = {
  air: false,
  disconnected: false,
  downed: false,
  faceX: 1,
  faceY: 0,
  fx: [] as readonly string[],
  hp: 0,
  maxHp: 1,
  name: "?",
  weapon: null,
  blocking: false,
};

export function remotePlayerFields(snapshot: EntitySnapshot): RemotePlayerFields {
  const player = { ...REMOTE_DEFAULTS, ...snapshot } as typeof REMOTE_DEFAULTS & EntitySnapshot;
  return {
    name: player.name, hp: player.hp, maxHp: player.maxHp, fx: player.fx,
    faceX: player.faceX, faceY: player.faceY, air: player.air,
    downed: player.downed, disconnected: player.disconnected,
    attacking: player.anim === "attack", blocking: player.blocking,
    weaponId: player.weapon,
    weaponAimAngle: null, attackAngleRad: Math.atan2(player.faceY, player.faceX),
  };
}
