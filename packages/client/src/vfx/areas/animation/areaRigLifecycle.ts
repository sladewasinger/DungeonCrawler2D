export function shouldRestartAreaRig(
  active: boolean,
  previousPlacementKey: string,
  nextPlacementKey: string,
): boolean {
  return !active || previousPlacementKey !== nextPlacementKey;
}
