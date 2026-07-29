/** Conservative disk cap for an LOS-aware ground-light source radius. */
export function groundLightMaximumCells(radiusTiles: number): number {
  return Math.ceil(Math.PI * (radiusTiles + 0.5) ** 2);
}
