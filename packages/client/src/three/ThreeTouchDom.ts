export function releasePointerCapture(
  element: Element | null,
  pointerId: number | null,
): void {
  if (
    pointerId !== null &&
    element instanceof HTMLElement &&
    element.hasPointerCapture?.(pointerId)
  ) element.releasePointerCapture(pointerId);
}

export function pointerInside(
  element: Element | null,
  event: PointerEvent,
): boolean {
  const bounds = element?.getBoundingClientRect();
  return bounds !== undefined &&
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom;
}
