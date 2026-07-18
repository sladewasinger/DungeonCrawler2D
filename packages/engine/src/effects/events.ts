// Events the effects engine emits for the sim to broadcast; clients render outcomes, never compute them.

export type EffectEvent =
  | { t: "hp"; id: string; delta: number; hp: number }
  | { t: "status"; id: string; status: string; on: boolean }
  | { t: "death"; id: string }
  | { t: "destroy"; id: string }
  | { t: "spawnArea"; x: number; y: number; area: string; radius: number };
