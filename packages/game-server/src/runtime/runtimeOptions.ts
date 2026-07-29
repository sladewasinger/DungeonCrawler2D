/** Parses standalone server environment flags whose safe defaults affect live gameplay. */
export function enemiesAreFrozen(value: string | undefined): boolean {
  return value === "1";
}

/** VOID terrain ships on; an explicit false startup value restores finite raised walls. */
export function voidTerrainIsEnabled(value: string | undefined): boolean {
  if (value === undefined) return true;
  const normalized = value.toLowerCase();
  if (["1", "true", "on"].includes(normalized)) return true;
  if (["0", "false", "off"].includes(normalized)) return false;
  throw new Error(`VOID_TERRAIN must be 1/0, true/false, or on/off; received "${value}"`);
}
