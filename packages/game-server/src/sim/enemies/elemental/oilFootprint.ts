export function oilFootprintCells(
  point: { readonly x: number; readonly y: number },
  size: number,
): Array<{ readonly x: number; readonly y: number }> {
  const startX = Math.floor(point.x - (size - 1) / 2);
  const startY = Math.floor(point.y - (size - 1) / 2);
  const cells: Array<{ readonly x: number; readonly y: number }> = [];
  for (let y = startY; y < startY + size; y++) {
    for (let x = startX; x < startX + size; x++) cells.push({ x, y });
  }
  return cells;
}
