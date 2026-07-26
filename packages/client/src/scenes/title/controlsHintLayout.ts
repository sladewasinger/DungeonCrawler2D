export const CONTROLS_LINE =
  "WASD move · mouse aim & click attack · Shift run · Space jump · E interact · I inventory · C craft · Enter chat · F10 edit HUD";

export const COMPACT_CONTROLS_LINE = "WASD move · click attack · Enter chat — more in-game (F10)";

export const SHORT_VIEWPORT_HEIGHT = 650;
export const TITLE_HINT_MAX_WIDTH = 780;
export const TITLE_HINT_GUTTER = 24;

export const isShortViewport = (height: number): boolean => height < SHORT_VIEWPORT_HEIGHT;

export const titleHintContent = (height: number) => {
  const short = isShortViewport(height);
  return {
    premiseVisible: !short,
    controlsText: short ? COMPACT_CONTROLS_LINE : CONTROLS_LINE,
  };
};

export const titleHintLayout = (width: number, height: number) => {
  const doorScale = height <= 500 ? 0.68 : height <= SHORT_VIEWPORT_HEIGHT ? 0.82 : 1;
  const doorBottom = height * 0.25 + 72 * doorScale;
  const doorGap = isShortViewport(height) ? 12 : 16;
  return {
    ...titleHintContent(height),
    topPx: Math.max(Math.round(height * 0.38), Math.ceil(doorBottom + doorGap)),
    widthPx: Math.max(0, Math.min(TITLE_HINT_MAX_WIDTH, width - TITLE_HINT_GUTTER * 2)),
  };
};
