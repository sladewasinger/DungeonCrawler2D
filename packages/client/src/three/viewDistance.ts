/** Owns the supported terrain view distances and deterministic cycling behavior. */
export const VIEW_DISTANCES = [18, 26, 34] as const;

export type ViewDistance = (typeof VIEW_DISTANCES)[number];

export const isViewDistance = (value: number): value is ViewDistance => VIEW_DISTANCES.includes(value as ViewDistance);

export const nextViewDistance = (current: ViewDistance): ViewDistance => {
  const index = VIEW_DISTANCES.indexOf(current);
  return VIEW_DISTANCES[(index + 1) % VIEW_DISTANCES.length] ?? 18;
};
