/**
 * Connection's presentation-facing data shapes — split out of connection.ts to keep
 * the state facade under the file-size cap. Pure types only, no behavior.
 */

export interface Toast {
  msg: string;
  until: number;
}

export interface ChatLine {
  channel: string;
  from: string;
  name: string;
  text: string;
  /** DM thread partner's display name (set on "dm" lines only). */
  target?: string;
}

export interface ContactInfo {
  name: string;
  online: boolean;
}

/** Visual-only events the scene consumes each frame. */
export type VisualEvent =
  | { t: "hit"; id: string; amount: number }
  | { t: "death"; id: string }
  | { t: "status"; id: string; status: string; on: boolean }
  /** Client-detected (net/apply.ts's fistbumpSeal parse) — server sends no dedicated
   * wire event for a sealed contact, only the system chat line this is derived from. */
  | { t: "fistbumpSealed"; partnerName: string }
  /** Client-detected (net/xpEvents.ts) from a self.xp rise between snapshots — the
   * server sends no dedicated "you gained N xp" wire event, only the cumulative total. */
  | { t: "xpGained"; amount: number }
  /** Client-detected from a self.level rise between snapshots. */
  | { t: "levelUp"; level: number }
  /** Client-detected (net/floorEvents.ts) from a self floor change between snapshots
   * (Epic 7.14) — welcome.floor today; self.floor once the server lane's v15 bump lands. */
  | { t: "floorEntered"; floor: number }
  /** Client-detected (net/apply.ts) when a tracked boss entity's death event arrives. */
  | { t: "bossDown"; name: string };
