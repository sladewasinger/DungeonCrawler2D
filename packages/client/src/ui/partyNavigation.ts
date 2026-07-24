/** Resolves a party member's labeled compass direction and distance from the player. */

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"] as const;

export interface PartyNavigation {
  readonly arrow: string;
  readonly distance: number;
}

const wrapDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

export function resolvePartyNavigation(
  self: { x: number; y: number },
  member: { x: number; y: number },
  viewBearingDeg: number,
): PartyNavigation {
  const dx = member.x - self.x;
  const dy = member.y - self.y;
  const worldBearingDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const screenBearingDeg = wrapDegrees(viewBearingDeg + worldBearingDeg);
  const arrowIndex = Math.round(screenBearingDeg / 45) % ARROWS.length;
  return {
    arrow: ARROWS[arrowIndex] ?? ARROWS[0],
    distance: Math.round(Math.hypot(dx, dy)),
  };
}
