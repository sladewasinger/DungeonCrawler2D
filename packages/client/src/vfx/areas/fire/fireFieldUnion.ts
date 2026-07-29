export function fireTileOverlap(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number {
  let overlap = 0;
  for (const key of left) {
    if (right.has(key)) overlap++;
  }
  return overlap;
}
