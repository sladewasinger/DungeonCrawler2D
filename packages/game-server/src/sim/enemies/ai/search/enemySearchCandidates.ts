export interface EnemySearchCandidate {
  readonly x: number;
  readonly y: number;
}

interface SearchCandidateInput {
  readonly anchor: { readonly x: number; readonly y: number };
  readonly radius: number;
  readonly seed: number;
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
  const leftDistance = squaredDistance(input.anchor, left);
  const rightDistance = squaredDistance(input.anchor, right);
  return leftDistance - rightDistance ||
    phasedAngle(input, left) - phasedAngle(input, right);
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
