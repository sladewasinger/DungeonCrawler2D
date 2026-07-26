export const CONTROLS_LINE =
  "WASD move · mouse aim & click attack · Shift run · Space jump · E interact · I inventory · C craft · Enter chat · F10 edit HUD";

export const COMPACT_CONTROLS_LINE = "WASD move · click attack · Enter chat — more in-game (F10)";

export const SHORT_VIEWPORT_HEIGHT = 650;

export const isShortViewport = (height: number): boolean => height < SHORT_VIEWPORT_HEIGHT;

export const titleHintContent = (height: number) => {
  const short = isShortViewport(height);
  return {
    premiseVisible: !short,
    controlsText: short ? COMPACT_CONTROLS_LINE : CONTROLS_LINE,
  };
};
