export const EDITOR_FLOOR = 1;
export const DEFAULT_EDITOR_SEED = 228182761;

export function editorSeedFromSearch(search: URLSearchParams): number {
  const value = Number(search.get("seed"));
  return Number.isFinite(value) ? value : DEFAULT_EDITOR_SEED;
}
