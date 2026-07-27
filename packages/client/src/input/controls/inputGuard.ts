/** Prevents world actions while text fields or modal gameplay blockers own input. */
export const guardedAction = (
  action: () => void,
  blocked = () => false,
): (() => void) => () => {
  const element = document.activeElement;
  if (element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    blocked()) return;
  action();
};
