export function atlasReadinessChanged(
  previous: boolean | undefined,
  current: boolean,
): boolean {
  return previous !== current;
}
