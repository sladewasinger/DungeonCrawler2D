import {
  BODY_RADIUS,
  firstGuardSweepContact,
  guardVolume,
} from "@dc2d/engine";
import type { GuardVolume } from "@dc2d/engine";
import type { BodyState } from "@dc2d/engine";
import type { PlayerSlot, SimState } from "../state/state.js";

const GUARD_CONTACT_BACKOFF = 0.002;
const GUARD_SEPARATION_EPSILON = 0.002;

interface ActiveGuardMotionContact {
  readonly fraction: number;
  readonly guard: GuardVolume;
}

export function activeGuardBlocksEnemyMotion(
  sim: SimState,
  previous: Pick<BodyState, "x" | "y">,
  body: BodyState,
): boolean {
  const contact = firstActiveGuardContact(sim, previous, body);
  if (contact === undefined) return false;
  resolveGuardMotionContact(previous, body, contact);
  return true;
}

function firstActiveGuardContact(
  sim: SimState,
  previous: Pick<BodyState, "x" | "y">,
  body: BodyState,
): ActiveGuardMotionContact | undefined {
  let firstContact: ActiveGuardMotionContact | undefined;
  for (const slot of sim.players.values()) {
    const contact = activeGuardContact(slot, previous, body);
    if (contact === undefined) continue;
    firstContact = earlierContact(firstContact, contact);
  }
  return firstContact;
}

function activeGuardContact(
  slot: PlayerSlot,
  previous: Pick<BodyState, "x" | "y">,
  body: BodyState,
): ActiveGuardMotionContact | undefined {
  if (!slot.connected || !slot.blocking || slot.entity.hp <= 0) return undefined;
  const guard = guardVolume({
    center: slot.entity.body,
    facing: slot.entity.facing ?? { x: 1, y: 0 },
  });
  const fraction = firstGuardSweepContact({
    guard,
    start: previous,
    end: body,
    radius: BODY_RADIUS,
  });
  return fraction === undefined ? undefined : { fraction, guard };
}

function earlierContact(
  firstContact: ActiveGuardMotionContact | undefined,
  contact: ActiveGuardMotionContact,
): ActiveGuardMotionContact {
  if (firstContact === undefined) return contact;
  return contact.fraction < firstContact.fraction ? contact : firstContact;
}

function resolveGuardMotionContact(
  previous: Pick<BodyState, "x" | "y">,
  body: BodyState,
  contact: ActiveGuardMotionContact,
): void {
  if (contact.fraction <= 0) {
    separateBodyFromGuard(body, contact.guard);
    return;
  }
  moveBodyBeforeContact(previous, body, contact.fraction);
}

function moveBodyBeforeContact(
  previous: Pick<BodyState, "x" | "y">,
  body: BodyState,
  contact: number,
): void {
  const fraction = Math.max(0, contact - GUARD_CONTACT_BACKOFF);
  body.x = previous.x + (body.x - previous.x) * fraction;
  body.y = previous.y + (body.y - previous.y) * fraction;
}

function separateBodyFromGuard(body: BodyState, guard: GuardVolume): void {
  const direction = separationDirection(body, guard);
  const distance = guard.radius + BODY_RADIUS + GUARD_SEPARATION_EPSILON;
  body.x = guard.center.x + direction.x * distance;
  body.y = guard.center.y + direction.y * distance;
}

function separationDirection(
  body: Pick<BodyState, "x" | "y">,
  guard: GuardVolume,
): { x: number; y: number } {
  const offsetX = body.x - guard.center.x;
  const offsetY = body.y - guard.center.y;
  const length = Math.hypot(offsetX, offsetY);
  if (length > 0.001) return { x: offsetX / length, y: offsetY / length };
  return guard.facing;
}
