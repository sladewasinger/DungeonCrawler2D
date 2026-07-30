export interface EnemySearchCandidate {
  readonly x: number;
  readonly y: number;
}

interface SearchCandidateInput {
  readonly anchor: { readonly x: number; readonly y: number };
  readonly radius: number;
  readonly seed: number;
  readonly forward?: { readonly x: number; readonly y: number };
  readonly forwardDistance?: number;
}

/** Deterministic nearby tile centers, ordered from near to far. */
export function enemySearchCandidates(
  input: SearchCandidateInput,
): EnemySearchCandidate[] {
  const candidates: EnemySearchCandidate[] = [];
  const radius = Math.max(1, Math.floor(input.radius));
  const anchorTileX = Math.floor(input.anchor.x);
  const anchorTileY = Math.floor(input.anchor.y);
  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      addBoundedCandidate({
        input,
        candidates,
        x: anchorTileX + offsetX + 0.5,
        y: anchorTileY + offsetY + 0.5,
      });
    }
  }
  return candidates.sort((left, right) =>
    compareSearchCandidates(input, left, right));
}

interface CandidateAddition {
  readonly input: SearchCandidateInput;
  readonly candidates: EnemySearchCandidate[];
  readonly x: number;
  readonly y: number;
}

function addBoundedCandidate(addition: CandidateAddition): void {
  const { input, candidates, x, y } = addition;
  const distance = Math.hypot(x - input.anchor.x, y - input.anchor.y);
  if (distance < 0.75 || distance > input.radius) return;
  candidates.push({ x, y });
}

function compareSearchCandidates(
  input: SearchCandidateInput,
  left: EnemySearchCandidate,
  right: EnemySearchCandidate,
): number {
  const leftDirection = directionalPriority(input, left);
  const rightDirection = directionalPriority(input, right);
  const leftDistance = squaredDistance(input.anchor, left);
  const rightDistance = squaredDistance(input.anchor, right);
  return leftDirection - rightDirection ||
    leftDistance - rightDistance ||
    phasedAngle(input, left) - phasedAngle(input, right);
}

function directionalPriority(
  input: SearchCandidateInput,
  point: EnemySearchCandidate,
): number {
  const direction = input.forward;
  if (!direction) return 0;
  const normalized = normalizedDirection(direction);
  if (!normalized) return 0;
  const dx = point.x - input.anchor.x;
  const dy = point.y - input.anchor.y;
  const projection = dx * normalized.x + dy * normalized.y;
  const lateral = Math.abs(dx * normalized.y - dy * normalized.x);
  const desired = Math.min(
    input.radius,
    Math.max(1, input.forwardDistance ?? 1),
  );
  const reversePenalty = projection < 0 ? input.radius * 4 - projection : 0;
  return reversePenalty + Math.abs(projection - desired) * 2 + lateral;
}

function normalizedDirection(
  direction: { readonly x: number; readonly y: number },
): { x: number; y: number } | undefined {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude === 0) return undefined;
  return { x: direction.x / magnitude, y: direction.y / magnitude };
}

function phasedAngle(
  input: SearchCandidateInput,
  point: EnemySearchCandidate,
): number {
  const phase = (input.seed >>> 0) / 0x1_0000_0000 * Math.PI * 2;
  const angle = Math.atan2(
    point.y - input.anchor.y,
    point.x - input.anchor.x,
  ) - phase;
  return (angle + Math.PI * 4) % (Math.PI * 2);
}

function squaredDistance(
  from: { readonly x: number; readonly y: number },
  to: EnemySearchCandidate,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
}
