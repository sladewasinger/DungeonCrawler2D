export type HtmlTouchAction =
  | "attack"
  | "block"
  | "jump"
  | "interact"
  | "throw";

export interface HtmlTouchActionRegion {
  readonly action: HtmlTouchAction;
  readonly label: string;
  readonly right: number;
  readonly bottom: number;
  readonly size: number;
}

export interface HtmlTouchBox {
  readonly left: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export const HTML_TOUCH_ACTIONS: readonly HtmlTouchActionRegion[] = [
  { action: "attack", label: "ATTACK", right: 20, bottom: 64, size: 48 },
  { action: "block", label: "BLOCK", right: 74, bottom: 64, size: 48 },
  { action: "jump", label: "JUMP", right: 22, bottom: 118, size: 44 },
  { action: "interact", label: "USE", right: 72, bottom: 118, size: 44 },
  { action: "throw", label: "THROW", right: 122, bottom: 118, size: 44 },
];

export const HTML_TOUCH_STICK: HtmlTouchBox = {
  left: 20,
  bottom: 20,
  width: 96,
  height: 96,
};

export const HTML_TOUCH_BAG = {
  bottom: 48,
  width: 52,
  height: 36,
} as const;

export const touchActionCenter = (
  region: HtmlTouchActionRegion,
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: width - region.right - region.size / 2,
  y: height - region.bottom - region.size / 2,
});

export const touchActionBounds = (
  region: HtmlTouchActionRegion,
  width: number,
  height: number,
): { left: number; top: number; right: number; bottom: number } => ({
  left: width - region.right - region.size,
  top: height - region.bottom - region.size,
  right: width - region.right,
  bottom: height - region.bottom,
});
