/** Compatibility query parameter for the terrain atlas debug view. */
export const TERRAIN_DEBUG_QUERY_PARAM = "terrain4Debug";

export function terrainDebugIsEnabled(search: string): boolean {
  return new URLSearchParams(search).get(TERRAIN_DEBUG_QUERY_PARAM) === "1";
}
