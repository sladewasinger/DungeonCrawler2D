import type { PlayerSkin } from "@dc2d/engine";
import type Phaser from "phaser";
import type { PlayerEntityView } from "../../render/entities/visuals/view.js";
import { VfxSystem } from "../../vfx/system/index.js";

export type CharacterVfxActorId = "breath" | "run" | "walk" | "jump";

export interface CharacterVfxActor {
  readonly id: CharacterVfxActorId;
  readonly name: string;
  readonly detail: string;
  readonly skin: PlayerSkin;
  readonly vfx: VfxSystem;
  readonly state: CharacterVfxActorState;
}

export interface CharacterVfxActorState {
  x: number;
  y: number;
  z: number;
  faceX: number;
  air: boolean;
}

interface ActorSpec {
  readonly id: CharacterVfxActorId;
  readonly x: number;
  readonly name: string;
  readonly detail: string;
  readonly skin: PlayerSkin;
  readonly breath: boolean;
}

const ACTOR_SPECS: readonly ActorSpec[] = [
  { id: "breath", x: 6, name: "OUT OF BREATH / CURSOR", detail: "faces the pointer", skin: "knight_f", breath: true },
  { id: "run", x: 14, name: "RUN / RIGHT-LEFT", detail: "unlimited stamina", skin: "dwarf_f", breath: false },
  { id: "walk", x: 22, name: "WALK / LEFT-RIGHT", detail: "walking pace", skin: "elf_f", breath: false },
  { id: "jump", x: 30, name: "JUMP + LAND / PAUSE", detail: "watch the dust", skin: "wizzard_f", breath: false },
];

export function createCharacterVfxActors(scene: Phaser.Scene): CharacterVfxActor[] {
  return ACTOR_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    detail: spec.detail,
    skin: spec.skin,
    vfx: new VfxSystem(scene),
    state: { x: spec.x, y: 8, z: 0, faceX: spec.id === "walk" ? -1 : 1, air: false },
  }));
}

export function characterVfxPlayerViews(actors: readonly CharacterVfxActor[]): PlayerEntityView[] {
  return actors.map((actor) => ({
    id: `character-vfx:${actor.id}`,
    playerId: `character-vfx:${actor.id}`,
    skin: actor.skin,
    name: actor.name,
    x: actor.state.x,
    y: actor.state.y,
    z: actor.state.z,
    hp: 100,
    maxHp: 100,
    fx: [],
    faceX: actor.state.faceX,
    faceY: 0,
    air: actor.state.air,
    downed: false,
    disconnected: false,
    attacking: false,
    blocking: false,
    weaponId: null,
    weaponAimAngle: null,
    attackAngleRad: 0,
  }));
}

export function disposeCharacterVfxActors(actors: readonly CharacterVfxActor[]): void {
  for (const actor of actors) actor.vfx.dispose();
}
