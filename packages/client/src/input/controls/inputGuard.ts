/** Prevents world actions while text fields or modal gameplay blockers own input. */
export const inputActionBlocked = (
  blocked = () => false,
): boolean => {
  const element = document.activeElement;
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    blocked();
};

export const guardedAction = (
  action: () => void,
  blocked = () => false,
): (() => void) => () => {
  if (inputActionBlocked(blocked)) return;
  action();
};
