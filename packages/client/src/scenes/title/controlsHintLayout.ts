// Pure layout math for TitleControlsHint, split out of controlsHint.ts so the
// viewport-aware stacking/collapse rules (judge-panel: title-screen text collision at
// 844x390) are unit-testable without a live Phaser scene to measure text against.
export const WRAP_WIDTH = 640;
export const CONTROLS_LINE =
  "WASD move · mouse aim & click attack · Shift run · Space jump · E interact · I inventory · C craft · Enter chat · F10 edit HUD";
/** Below this logical viewport height (a landscape phone, e.g. 844x390), the full
 * premise paragraph and cheat-sheet don't fit above ConnectForm's bottom overlay
 * without overlapping: hide the premise and collapse the cheat-sheet to one line. */
export const SHORT_VIEWPORT_HEIGHT = 480;
export const COMPACT_CONTROLS_LINE = "WASD move · click attack · Enter chat — more in-game (F10)";

export function isShortViewport(height: number): boolean {
  return height < SHORT_VIEWPORT_HEIGHT;
}

/** Clamped so the premise's word-wrap never exceeds a narrow viewport's own width. */
export function wrapWidthFor(width: number): number {
  return Math.max(160, Math.min(WRAP_WIDTH, width - 48));
}

export interface ControlsHintPositions {
  short: boolean;
  controlsText: string;
  taglineY: number;
  premiseVisible: boolean;
  premiseY: number;
  controlsY: number;
}

/**
 * Stacks premise/controls by *measured* text height below the tagline rather than
 * fixed height fractions — the premise paragraph wraps to a variable number of lines
 * depending on width, and fixed fractions let a taller wrap collide with the controls
 * line below it. On short viewports the premise is dropped and the cheat-sheet
 * collapses to one compact line so the block clears the door/form without shrinking
 * font sizes. `taglineHeight`/`premiseHeight`/`controlsHeight` are the live rendered
 * text heights (Phaser.GameObjects.Text#height) for the *current* content/wrap width.
 * Only vertical stacking lives here — horizontal centering (`width / 2`) is the
 * caller's concern, so `width` isn't a parameter.
 */
export function computeControlsHintLayout(
  height: number,
  taglineHeight: number,
  premiseHeight: number,
  controlsHeight: number,
): ControlsHintPositions {
  const short = isShortViewport(height);
  const taglineY = height * 0.34;
  let cursorY = taglineY + taglineHeight / 2 + 8;
  let premiseY = cursorY;
  if (!short) {
    premiseY = cursorY;
    cursorY += premiseHeight + 10;
  }
  return {
    short,
    controlsText: short ? COMPACT_CONTROLS_LINE : CONTROLS_LINE,
    taglineY,
    premiseVisible: !short,
    premiseY,
    controlsY: cursorY + controlsHeight / 2,
  };
}
