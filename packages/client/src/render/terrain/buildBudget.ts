/** Advances background build work without letting one frame consume an unbounded amount of time. */
export function runBuildBudget(
  hasWork: () => boolean,
  step: () => void,
  budgetMs: number,
  now: () => number,
): number {
  const startedAt = now();
  let completedSteps = 0;
  while (hasWork() && (completedSteps === 0 || now() - startedAt < budgetMs)) {
    step();
    completedSteps++;
  }
  return completedSteps;
}
