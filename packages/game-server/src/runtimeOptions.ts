/** Parses standalone server environment flags whose safe defaults affect live gameplay. */
export function enemiesAreFrozen(value: string | undefined): boolean {
  return value === "1";
}
