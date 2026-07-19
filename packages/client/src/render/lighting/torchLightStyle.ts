// Shared warm firelight styling so placed-torch entities render identically to the
// authored world torches they visually join (same halo color/radius, same flame
// particle recipe via LightingSystem.activeTorches()).
export const TORCH_COLOR = 0xff9e3d;
export const TORCH_RADIUS_TILES = 1.5;
/** A flying torch only gets a plain travel glow — smaller, and never kind "torch"
 * (that would spawn a flame particle chasing the arc; flames are a landed-only cue). */
export const TORCH_FLIGHT_RADIUS_TILES = 1.0;
