/** Parses standalone server environment flags whose safe defaults affect live gameplay. */
export function enemiesAreFrozen(value: string | undefined): boolean {
  return value === "1";
}

/** Finite terrain is the safe default; VOID mode requires an explicit startup opt-in. */
export function voidTerrainIsEnabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.toLowerCase();
  if (["1", "true", "on"].includes(normalized)) return true;
  if (["0", "false", "off"].includes(normalized)) return false;
  throw new Error(`VOID_TERRAIN must be 1/0, true/false, or on/off; received "${value}"`);
}
